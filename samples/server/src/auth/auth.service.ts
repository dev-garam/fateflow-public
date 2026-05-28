import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, Prisma, User, UserIdentity, UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import { Buffer } from 'buffer';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppOriginPolicyService } from '../config/app-origin-policy.service';
import { AuthTokensResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { AuthLoginState } from './interfaces/auth-login-state.interface';
import { GoogleUserProfile } from './interfaces/google-user-profile.interface';
import { AccessTokenPayload, RefreshTokenPayload } from './interfaces/jwt-payload.interface';

interface CachedLoginCodePayload {
  provider: AuthProvider;
  tokens: AuthTokensResponseDto;
}

interface CachedAuthSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly appOriginPolicyService: AppOriginPolicyService,
  ) {}

  async signInWithGoogle(profile: GoogleUserProfile): Promise<AuthTokensResponseDto> {
    const providerUserId = profile.rawProfile?.sub ?? profile.id;
    const providerEmail = profile.emails?.[0]?.value ?? profile.rawProfile?.email ?? null;
    const emailVerified =
      profile.rawProfile?.email_verified ?? profile.emails?.[0]?.verified ?? false;
    const displayName = profile.displayName ?? profile.rawProfile?.name ?? null;
    const profileImageUrl = profile.photos?.[0]?.value ?? profile.rawProfile?.picture ?? null;
    const now = new Date();

    const identity = await this.prismaService.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId,
        },
      },
      include: {
        user: true,
      },
    });

    let userRecord: User;
    let identityRecord: UserIdentity;

    if (!identity) {
      const created = await this.prismaService.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            displayName,
            profileImageUrl,
            lastLoginAt: now,
          },
        });

        const createdIdentity = await tx.userIdentity.create({
          data: {
            userId: user.id,
            provider: AuthProvider.GOOGLE,
            providerUserId,
            email: providerEmail,
            emailVerified,
            providerUsername: displayName,
            providerAvatarUrl: profileImageUrl,
            rawProfileJson: this.toJsonValue(profile.rawProfile),
            lastLoginAt: now,
          },
        });

        return { user, identity: createdIdentity };
      });

      userRecord = created.user;
      identityRecord = created.identity;
    } else {
      const updated = await this.prismaService.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: identity.user.id },
          data: {
            displayName,
            profileImageUrl,
            lastLoginAt: now,
          },
        });

        const updatedIdentity = await tx.userIdentity.update({
          where: { id: identity.id },
          data: {
            email: providerEmail,
            emailVerified,
            providerUsername: displayName,
            providerAvatarUrl: profileImageUrl,
            rawProfileJson: this.toJsonValue(profile.rawProfile),
            lastLoginAt: now,
          },
        });

        return { user, identity: updatedIdentity };
      });

      userRecord = updated.user;
      identityRecord = updated.identity;
    }

    if (userRecord.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('활성 사용자만 로그인할 수 있습니다.');
    }

    return this.issueTokens(userRecord, identityRecord);
  }

  async createFrontendLoginResult(
    profile: GoogleUserProfile,
    redirectUrl: string,
  ): Promise<{ redirectUrl: string }> {
    const tokens = await this.signInWithGoogle(profile);
    const loginCode = randomUUID();
    const ttlSeconds = this.configService.get<number>('AUTH_LOGIN_CODE_EXPIRES_IN_SECONDS', 60);

    await this.redisService.client.set(
      this.loginCodeKey(loginCode),
      JSON.stringify({
        provider: AuthProvider.GOOGLE,
        tokens,
      } satisfies CachedLoginCodePayload),
      'EX',
      ttlSeconds,
    );

    const targetUrl = new URL(redirectUrl);
    targetUrl.searchParams.set('code', loginCode);

    return {
      redirectUrl: targetUrl.toString(),
    };
  }

  async exchangeLoginCode(code: string, provider: AuthProvider): Promise<AuthTokensResponseDto> {
    const cacheValue = await this.redisService.client.get(this.loginCodeKey(code));

    if (!cacheValue) {
      throw new UnauthorizedException('유효하지 않거나 만료된 로그인 코드입니다.');
    }

    const parsed = JSON.parse(cacheValue) as Partial<CachedLoginCodePayload> | AuthTokensResponseDto;
    const cachedPayload =
      'tokens' in parsed && 'provider' in parsed
        ? (parsed as CachedLoginCodePayload)
        : ({
            provider: AuthProvider.GOOGLE,
            tokens: parsed as AuthTokensResponseDto,
          } satisfies CachedLoginCodePayload);

    if (cachedPayload.provider !== provider) {
      throw new UnauthorizedException('로그인 코드 provider가 일치하지 않습니다.');
    }

    await this.redisService.client.del(this.loginCodeKey(code));
    return cachedPayload.tokens;
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokensResponseDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const sessionId = await this.redisService.client.get(this.refreshTokenKey(refreshToken));

    if (!sessionId) {
      throw new UnauthorizedException('refresh session을 찾을 수 없습니다.');
    }

    const cachedSession = await this.getCachedSession(sessionId);

    if (
      !cachedSession ||
      cachedSession.refreshToken !== refreshToken ||
      cachedSession.userId !== payload.sub
    ) {
      await this.deleteCachedSession(sessionId, cachedSession ?? undefined);
      throw new UnauthorizedException('refresh token이 유효하지 않습니다.');
    }

    const user = await this.getActiveUserById(cachedSession.userId);
    const identity = this.getPrimaryIdentity(user);
    return this.rotateTokens(sessionId, cachedSession, user, identity);
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    const cachedSession = await this.getCachedSession(sessionId);

    if (!cachedSession || cachedSession.userId !== userId) {
      return;
    }

    await this.deleteCachedSession(sessionId, cachedSession);
  }

  async withdraw(userId: string): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
      },
    });

    const sessionIds = await this.redisService.client.smembers(this.userSessionsKey(userId));

    for (const sessionId of sessionIds) {
      await this.deleteCachedSession(sessionId);
    }

    await this.redisService.client.del(this.userSessionsKey(userId));
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.getActiveUserById(userId);
    const identity = this.getPrimaryIdentity(user);
    return this.toAuthUserResponse(user, identity);
  }

  encodeLoginState(state: AuthLoginState): string {
    return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  }

  parseLoginState(state: string | undefined): AuthLoginState | null {
    if (!state) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as Partial<AuthLoginState>;

      if (typeof parsed.redirectUrl !== 'string' || parsed.redirectUrl.length === 0) {
        return null;
      }

      return {
        redirectUrl: parsed.redirectUrl,
      };
    } catch {
      return null;
    }
  }

  resolveRedirectUrl(
    redirectUrl: string | undefined,
    redirectPath: string | undefined,
    requestOrigin?: string,
    requestReferer?: string,
  ): string {
    if (redirectUrl) {
      return this.normalizeRedirectUrl(redirectUrl);
    }

    if (!redirectPath) {
      throw new BadRequestException('redirectUrl 또는 redirectPath가 필요합니다.');
    }

    if (!redirectPath.startsWith('/')) {
      throw new BadRequestException('redirectPath는 /로 시작해야 합니다.');
    }

    const origin = this.extractRequestOrigin(requestOrigin, requestReferer);

    if (!origin) {
      throw new BadRequestException('redirectPath를 해석할 프론트 origin을 찾을 수 없습니다.');
    }

    return this.normalizeRedirectUrl(new URL(redirectPath, origin).toString());
  }

  private normalizeRedirectUrl(redirectUrl: string): string {
    let normalizedUrl: URL;

    try {
      normalizedUrl = new URL(redirectUrl);
    } catch {
      throw new BadRequestException('유효한 redirectUrl이 아닙니다.');
    }

    if (!this.appOriginPolicyService.isAllowedOrigin(normalizedUrl.origin)) {
      throw new BadRequestException('허용되지 않은 redirectUrl origin입니다.');
    }

    return normalizedUrl.toString();
  }

  private extractRequestOrigin(
    requestOrigin?: string,
    requestReferer?: string,
  ): string | null {
    if (requestOrigin) {
      try {
        return new URL(requestOrigin).origin;
      } catch {
        throw new BadRequestException('유효한 Origin 헤더가 아닙니다.');
      }
    }

    if (requestReferer) {
      try {
        return new URL(requestReferer).origin;
      } catch {
        throw new BadRequestException('유효한 Referer 헤더가 아닙니다.');
      }
    }

    return null;
  }

  private async rotateTokens(
    sessionId: string,
    cachedSession: CachedAuthSession,
    user: User,
    identity: UserIdentity,
  ): Promise<AuthTokensResponseDto> {
    const refreshTokenExpiresIn = this.getRefreshTokenTtlSeconds();
    const accessToken = await this.createAccessToken(user, identity);
    const accessTokenExpiresIn = this.getAccessTokenTtlSeconds();
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        status: user.status,
        provider: identity.provider,
        type: 'refresh',
      } satisfies RefreshTokenPayload,
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTokenExpiresIn,
      },
    );

    await this.deleteCachedSession(sessionId, cachedSession);
    await this.storeCachedSession(sessionId, {
      userId: user.id,
      accessToken,
      refreshToken,
    }, accessTokenExpiresIn, refreshTokenExpiresIn);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
      user: this.toAuthUserResponse(user, identity),
    };
  }

  private async issueTokens(
    user: User,
    identity: UserIdentity,
  ): Promise<AuthTokensResponseDto> {
    const sessionId = randomUUID();
    const accessTokenExpiresIn = this.getAccessTokenTtlSeconds();
    const refreshTokenExpiresIn = this.getRefreshTokenTtlSeconds();

    const accessToken = await this.createAccessToken(user, identity);
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        status: user.status,
        provider: identity.provider,
        type: 'refresh',
      } satisfies RefreshTokenPayload,
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTokenExpiresIn,
      },
    );

    await this.storeCachedSession(
      sessionId,
      {
        userId: user.id,
        accessToken,
        refreshToken,
      },
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
      user: this.toAuthUserResponse(user, identity),
    };
  }

  private async createAccessToken(user: User, identity: UserIdentity): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        status: user.status,
        provider: identity.provider,
        type: 'access',
      } satisfies AccessTokenPayload,
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.getAccessTokenTtlSeconds(),
      },
    );
  }

  private async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 refresh token입니다.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('유효한 refresh token이 아닙니다.');
    }

    return payload;
  }

  async validateAccessToken(token: string): Promise<string | null> {
    return this.redisService.client.get(this.accessTokenKey(token));
  }

  private async storeCachedSession(
    sessionId: string,
    session: CachedAuthSession,
    accessTtlSeconds: number,
    refreshTtlSeconds: number,
  ): Promise<void> {
    const sessionTtlSeconds = Math.max(accessTtlSeconds, refreshTtlSeconds);

    await this.redisService.client
      .multi()
      .set(this.sessionKey(sessionId), JSON.stringify(session), 'EX', sessionTtlSeconds)
      .set(this.accessTokenKey(session.accessToken), sessionId, 'EX', accessTtlSeconds)
      .set(this.refreshTokenKey(session.refreshToken), sessionId, 'EX', refreshTtlSeconds)
      .sadd(this.userSessionsKey(session.userId), sessionId)
      .expire(this.userSessionsKey(session.userId), sessionTtlSeconds)
      .exec();
  }

  private async getCachedSession(sessionId: string): Promise<CachedAuthSession | null> {
    const cachedValue = await this.redisService.client.get(this.sessionKey(sessionId));

    if (!cachedValue) {
      return null;
    }

    return JSON.parse(cachedValue) as CachedAuthSession;
  }

  private async deleteCachedSession(
    sessionId: string,
    cachedSession?: CachedAuthSession,
  ): Promise<void> {
    const resolvedSession = cachedSession ?? (await this.getCachedSession(sessionId));

    if (!resolvedSession) {
      await this.redisService.client.del(this.sessionKey(sessionId));
      return;
    }

    await this.redisService.client
      .multi()
      .del(this.sessionKey(sessionId))
      .del(this.accessTokenKey(resolvedSession.accessToken))
      .del(this.refreshTokenKey(resolvedSession.refreshToken))
      .srem(this.userSessionsKey(resolvedSession.userId), sessionId)
      .exec();
  }

  private async getActiveUserById(userId: string): Promise<User & { identities: UserIdentity[] }> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        identities: {
          take: 1,
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('활성 사용자 정보를 찾을 수 없습니다.');
    }

    return user;
  }

  private getPrimaryIdentity(user: User & { identities: UserIdentity[] }): UserIdentity {
    const identity = user.identities[0];

    if (!identity) {
      throw new UnauthorizedException('사용자 소셜 계정을 찾을 수 없습니다.');
    }

    return identity;
  }

  private toAuthUserResponse(user: User, identity: UserIdentity): AuthUserDto {
    return {
      id: user.id,
      status: user.status,
      provider: identity.provider,
      email: identity.email,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      profileImageUrl: user.profileImageUrl,
    };
  }

  private toJsonValue(value: object | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!value) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private getAccessTokenTtlSeconds(): number {
    return this.parseDurationToSeconds(
      this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
    );
  }

  private getRefreshTokenTtlSeconds(): number {
    return this.parseDurationToSeconds(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );
  }

  private parseDurationToSeconds(duration: string): number {
    const normalized = duration.trim().toLowerCase();
    const matched = normalized.match(/^(\d+)([smhd])?$/);

    if (!matched) {
      throw new Error(`지원하지 않는 duration 형식입니다: ${duration}`);
    }

    const value = Number(matched[1]);
    const unit = matched[2] ?? 's';

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        throw new Error(`지원하지 않는 duration 단위입니다: ${duration}`);
    }
  }

  private sessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private accessTokenKey(token: string): string {
    return `access:token:${token}`;
  }

  private refreshTokenKey(token: string): string {
    return `refresh:token:${token}`;
  }

  private userSessionsKey(userId: string): string {
    return `user:${userId}:sessions`;
  }

  private loginCodeKey(code: string): string {
    return `login-code:${code}`;
  }
}
