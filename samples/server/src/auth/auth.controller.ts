import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUserDto, AuthTokensResponseDto } from './dto/auth-response.dto';
import { AuthExchangeRequestDto } from './dto/auth-exchange-request.dto';
import { Public } from './decorators/public.decorator';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { GoogleUserProfile } from './interfaces/google-user-profile.interface';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & { user: GoogleUserProfile };
type GoogleCallbackRequest = AuthenticatedRequest & { query: { state?: string } };

@ApiTags('인증')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: '구글 로그인 시작',
    description: 'Google OAuth 인증 화면으로 이동합니다.',
  })
  @ApiQuery({
    name: 'redirectUrl',
    required: false,
    description: '로그인 완료 후 서버가 다시 이동시킬 프론트 callback URL입니다.',
  })
  @ApiQuery({
    name: 'redirectPath',
    required: false,
    description: '프론트 현재 origin 기준 callback 경로입니다. 예: /auth/callback',
  })
  @Get('google')
  async googleLogin(): Promise<void> {}

  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: '구글 로그인 콜백',
    description:
      'Google OAuth 인증 후 redirectUrl이 있으면 프론트 callback URL로 1회용 로그인 코드를 전달하고, 없으면 토큰 JSON을 반환합니다.',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto, description: '구글 로그인 성공' })
  @Get('google/callback')
  async googleCallback(
    @Req() request: GoogleCallbackRequest,
    @Res() response: Response,
  ): Promise<void> {
    const loginState = this.authService.parseLoginState(request.query.state);

    if (!loginState) {
      response.json(await this.authService.signInWithGoogle(request.user));
      return;
    }

    const result = await this.authService.createFrontendLoginResult(
      request.user,
      loginState.redirectUrl,
    );
    response.redirect(result.redirectUrl);
  }

  @Public()
  @ApiOperation({
    summary: '로그인 코드 교환',
    description: '프론트 callback URL로 받은 1회용 로그인 코드를 토큰으로 교환합니다.',
  })
  @ApiBody({ type: AuthExchangeRequestDto })
  @ApiOkResponse({ type: AuthTokensResponseDto, description: '로그인 코드 교환 성공' })
  @Post('exchange')
  async exchange(@Body() body: AuthExchangeRequestDto): Promise<AuthTokensResponseDto> {
    return this.authService.exchangeLoginCode(body.code, body.provider);
  }

  @Public()
  @ApiOperation({
    summary: '토큰 재발급',
    description: 'refresh token으로 access token과 refresh token을 재발급합니다.',
  })
  @ApiBody({ type: RefreshTokenRequestDto })
  @ApiOkResponse({ type: AuthTokensResponseDto, description: '토큰 재발급 성공' })
  @Post('refresh')
  async refresh(@Body() body: RefreshTokenRequestDto): Promise<AuthTokensResponseDto> {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '내 정보 조회',
    description: '현재 access token에 연결된 사용자 정보를 조회합니다.',
  })
  @ApiOkResponse({ type: AuthUserDto, description: '내 정보 조회 성공' })
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.authService.getMe(user.userId);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '로그아웃',
    description: '현재 access token이 가리키는 세션을 종료하고 연결된 refresh token도 함께 삭제합니다.',
  })
  @ApiOkResponse({
    description: '로그아웃 성공',
    schema: {
      properties: {
        success: {
          type: 'boolean',
        },
      },
    },
  })
  @Post('logout')
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    await this.authService.logout(user.userId, user.sessionId);
    return { success: true };
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '회원탈퇴',
    description: '현재 사용자를 soft delete 처리하고 연결된 모든 인증 세션을 종료합니다.',
  })
  @ApiOkResponse({
    description: '회원탈퇴 성공',
    schema: {
      properties: {
        success: {
          type: 'boolean',
        },
      },
    },
  })
  @Post('withdraw')
  async withdraw(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    await this.authService.withdraw(user.userId);
    return { success: true };
  }
}
