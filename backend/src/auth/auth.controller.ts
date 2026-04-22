import {
  Controller, Post, Get, Body, HttpCode, HttpStatus,
  Res, Req, UseGuards, UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/** HttpOnly cookie name for the refresh token */
const REFRESH_COOKIE = 'refresh_token';
/** HttpOnly cookie name for the access token (kept for legacy cookie-based clients) */
const ACCESS_COOKIE  = 'access_token';

const REFRESH_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function refreshCookieOptions(res: boolean) {
  return {
    httpOnly: true,
    secure: res,           // HTTPS only in production
    sameSite: 'lax' as const,
    maxAge: REFRESH_COOKIE_TTL_MS,
    path: '/api/v1/auth',  // scope cookie to /auth/* only
  };
}

function accessCookieOptions(prod: boolean) {
  return {
    httpOnly: true,
    secure: prod,
    sameSite: 'lax' as const,
    maxAge: 15 * 60 * 1000, // 15 min — matches JWT expiry
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─────────────────────────────────────────────────────────────
  // POST /auth/login
  // ─────────────────────────────────────────────────────────────
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and receive access + refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens issued; refresh token set as HttpOnly cookie.' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    const prod = process.env.NODE_ENV === 'production';

    // Access token in cookie (15 min) + refresh token in scoped cookie (7 d)
    res.cookie(ACCESS_COOKIE,  result.access_token,  accessCookieOptions(prod));
    res.cookie(REFRESH_COOKIE, result.refresh_token, refreshCookieOptions(prod));

    // Also return tokens in body so the SPA can store access_token in localStorage
    return {
      access_token:  result.access_token,
      refresh_token: result.refresh_token,
      user:          result.user,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // POST /auth/refresh
  // Uses the refresh_token cookie (or body) to issue new token pair.
  // ─────────────────────────────────────────────────────────────
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate access + refresh token pair using a valid refresh token' })
  @ApiResponse({ status: 200, description: 'New token pair issued.' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { userId?: string; refresh_token?: string },
  ) {
    // Accept refresh token from HttpOnly cookie (preferred) or request body (fallback)
    const rawToken: string | undefined =
      (req.cookies as any)?.[REFRESH_COOKIE] ||
      body?.refresh_token;

    // Accept userId from body (sent by SPA along with the refresh token)
    const userId: string | undefined = body?.userId;

    if (!rawToken || !userId) {
      throw new UnauthorizedException('Missing refresh token or user identifier.');
    }

    const result = await this.authService.refreshTokens(userId, rawToken);
    const prod = process.env.NODE_ENV === 'production';

    // Rotate cookies
    res.cookie(ACCESS_COOKIE,  result.access_token,  accessCookieOptions(prod));
    res.cookie(REFRESH_COOKIE, result.refresh_token, refreshCookieOptions(prod));

    return {
      access_token:  result.access_token,
      refresh_token: result.refresh_token,
      user:          result.user,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // POST /auth/logout
  // ─────────────────────────────────────────────────────────────
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Invalidate refresh token and clear cookies' })
  @ApiResponse({ status: 200, description: 'Session fully terminated.' })
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Clear stored refresh token hash in DB → all sessions for this user are killed
    if (req.user?.id) {
      await this.authService.logout(req.user.id);
    }

    const prod = process.env.NODE_ENV === 'production';
    res.clearCookie(ACCESS_COOKIE,  { httpOnly: true, secure: prod, sameSite: 'lax' });
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: prod, sameSite: 'lax', path: '/api/v1/auth' });

    return { message: 'Logged out successfully. All sessions invalidated.' };
  }

  // ─────────────────────────────────────────────────────────────
  // GET /auth/me
  // ─────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile from valid access token' })
  @ApiResponse({ status: 200, description: 'Current user returned.' })
  async getMe(@Req() request: any) {
    return request.user;
  }

  // ─────────────────────────────────────────────────────────────
  // POST /auth/register
  // ─────────────────────────────────────────────────────────────
  @Post('register')
  @ApiOperation({ summary: 'Register new user account' })
  @ApiResponse({ status: 201, description: 'User registered; tokens issued.' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto);
    const prod = process.env.NODE_ENV === 'production';

    res.cookie(ACCESS_COOKIE,  result.access_token,  accessCookieOptions(prod));
    res.cookie(REFRESH_COOKIE, result.refresh_token, refreshCookieOptions(prod));

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // POST /auth/forgot-password
  // ─────────────────────────────────────────────────────────────
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset link sent if user exists.' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  // ─────────────────────────────────────────────────────────────
  // POST /auth/reset-password
  // ─────────────────────────────────────────────────────────────
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using one-time token' })
  @ApiResponse({ status: 200, description: 'Password reset; all refresh tokens invalidated.' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
