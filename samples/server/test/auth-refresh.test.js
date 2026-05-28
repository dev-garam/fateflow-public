const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');
const { AuthService } = require('../dist/auth/auth.service');

function createAuthService(overrides = {}) {
  return new AuthService(
    overrides.prismaService ?? {
      user: {
        findUnique: async () => null,
      },
    },
    overrides.redisService ?? {
      client: {
        get: async () => null,
        del: async () => 0,
        smembers: async () => [],
        multi: () => ({
          set() {
            return this;
          },
          sadd() {
            return this;
          },
          expire() {
            return this;
          },
          del() {
            return this;
          },
          srem() {
            return this;
          },
          exec: async () => [],
        }),
      },
    },
    overrides.jwtService ?? {
      verifyAsync: async () => {
        throw new Error('invalid token');
      },
    },
    overrides.configService ?? {
      getOrThrow: () => 'refresh-secret',
      get: () => 60,
    },
    overrides.appOriginPolicyService ?? {
      isAllowedOrigin: () => true,
    },
  );
}

test('refresh token verify errors are converted to UnauthorizedException', async () => {
  const service = createAuthService();

  await assert.rejects(
    service.refreshTokens('broken-refresh-token'),
    (error) =>
      error instanceof UnauthorizedException &&
      error.message === '유효하지 않거나 만료된 refresh token입니다.',
  );
});

test('refresh token rotation creates the new session before linking the old one', async () => {
  const rawRefreshToken = 'valid-refresh-token';
  const storedSession = {
    userId: 'user-1',
    accessToken: 'old-access-token',
    refreshToken: rawRefreshToken,
  };
  const payload = {
    sub: 'user-1',
    status: 'ACTIVE',
    provider: 'GOOGLE',
    type: 'refresh',
  };
  const multiCalls = [];

  const service = createAuthService({
    prismaService: {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          status: 'ACTIVE',
          displayName: 'Tester',
          phoneNumber: null,
          profileImageUrl: null,
          identities: [
            {
              provider: 'GOOGLE',
              email: 'test@example.com',
            },
          ],
        }),
      },
    },
    redisService: {
      client: {
        get: async (key) => {
          if (key === 'refresh:token:valid-refresh-token') return 'session-1';
          if (key === 'session:session-1') return JSON.stringify(storedSession);
          return null;
        },
        del: async () => 1,
        smembers: async () => [],
        multi: () => ({
          calls: multiCalls,
          del() {
            multiCalls.push(['del', ...arguments]);
            return this;
          },
          srem() {
            multiCalls.push(['srem', ...arguments]);
            return this;
          },
          set() {
            multiCalls.push(['set', ...arguments]);
            return this;
          },
          sadd() {
            multiCalls.push(['sadd', ...arguments]);
            return this;
          },
          expire() {
            multiCalls.push(['expire', ...arguments]);
            return this;
          },
          exec: async () => [],
        }),
      },
    },
    jwtService: {
      verifyAsync: async () => payload,
      signAsync: async (value) => (value.type === 'access' ? 'access-token' : 'refresh-token'),
    },
    configService: {
      getOrThrow: (key) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        if (key === 'JWT_ACCESS_SECRET') return 'access-secret';
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '30d';
        return 'value';
      },
      get: () => 60,
    },
  });

  const result = await service.refreshTokens(rawRefreshToken);

  assert.equal(result.accessToken, 'access-token');
  assert.equal(result.refreshToken, 'refresh-token');
  assert.match(
    multiCalls.map((call) => call[0]).join(','),
    /del,del,del,srem,set,set,set,sadd,expire/,
  );
});
