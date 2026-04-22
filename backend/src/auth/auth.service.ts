import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailerService } from '../common/mailer/mailer.service';

/** Access token is short-lived; refresh token is long-lived and rotated on every use */
const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL = '7d';          // clock-based
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // same in ms for cookie + DB expiry

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private prisma: PrismaService,
  ) { }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private buildPayload(user: { id: string; email: string; tenantId: string }, roleName: string) {
    return { email: user.email, sub: user.id, role: roleName, tenantId: user.tenantId };
  }

  private signAccessToken(payload: object): string {
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
  }

  /**
   * Generates a cryptographically random 64-byte hex refresh token,
   * stores the bcrypt hash in the DB, and returns the raw token (sent to client).
   */
  private async generateAndStoreRefreshToken(userId: string): Promise<string> {
    const raw = crypto.randomBytes(64).toString('hex');
    const hash = await bcrypt.hash(raw, 10);
    const expires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash, refreshTokenExpires: expires },
    });

    return raw;
  }

  /**
   * Validates a raw refresh token against the stored hash.
   * Returns the full user record on success, throws UnauthorizedException on failure.
   */
  private async validateRefreshToken(userId: string, rawToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user?.refreshTokenHash || !user?.refreshTokenExpires) {
      throw new UnauthorizedException('No active refresh token. Please log in again.');
    }

    if (user.refreshTokenExpires < new Date()) {
      throw new UnauthorizedException('Refresh token expired. Please log in again.');
    }

    const valid = await bcrypt.compare(rawToken, user.refreshTokenHash);
    if (!valid) {
      // Potential token theft — clear stored token as defence
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null, refreshTokenExpires: null },
      });
      throw new UnauthorizedException('Invalid refresh token. Session terminated for security.');
    }

    return user;
  }

  // ─────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.validateUser(email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Wrong credentials: username or password is incorrect.');
    }

    const userWithRole = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });

    const roleName = userWithRole?.role?.roleName || 'ANALYST';
    const payload = this.buildPayload(user, roleName);

    const accessToken = this.signAccessToken(payload);
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: roleName,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * Rotates the refresh token:
   * - Validates the incoming raw refresh token against the stored hash
   * - Issues a fresh access token
   * - Issues a fresh refresh token (old one is immediately invalidated in DB)
   */
  async refreshTokens(userId: string, rawRefreshToken: string) {
    const user = await this.validateRefreshToken(userId, rawRefreshToken);

    const roleName = user.role?.roleName || 'ANALYST';
    const payload = this.buildPayload(
      { id: user.id, email: user.email, tenantId: user.tenantId },
      roleName,
    );

    const accessToken = this.signAccessToken(payload);
    const refreshToken = await this.generateAndStoreRefreshToken(user.id); // rotate

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: roleName,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * Clears the stored refresh token hash, invalidating all active sessions for the user.
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, refreshTokenExpires: null },
    });
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }
    const user = await this.usersService.create(registerDto);

    const userWithRole = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    const roleName = userWithRole?.role?.roleName || 'ANALYST';

    const payload = this.buildPayload(
      { id: user.id, email: user.email, tenantId: user.tenantId },
      roleName,
    );
    const accessToken = this.signAccessToken(payload);
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, role: roleName, tenantId: user.tenantId },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const normalizedEmail = forgotPasswordDto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new NotFoundException('No account found with this email.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpires: expires,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8000'}/reset-password?token=${token}`;
    
    await this.mailerService.sendMail(
      user.email,
      'Password Reset Request - DORA SaaS',
      `
      <h1>Password Reset Request</h1>
      <p>Hello ${user.fullName || 'User'},</p>
      <p>You requested a password reset for your DORA SaaS account. Please click the link below to set a new password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in 1 hour and can only be used once.</p>
      <p>If you did not request this, please ignore this email.</p>
      `,
    );

    return { message: 'A password reset link has been sent to your email.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: resetPasswordDto.token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        // Invalidate any existing refresh tokens on password reset (security)
        refreshTokenHash: null,
        refreshTokenExpires: null,
      },
    });

    return { message: 'Your password has been successfully reset.' };
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      await this.jwtService.verifyAsync(token);
      return true;
    } catch {
      return false;
    }
  }

  async getUserFromToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });
      
      if (!user) return null;

      const { passwordHash, resetToken, resetTokenExpires, refreshTokenHash, refreshTokenExpires, ...result } = user;
      return {
        ...result,
        role: user.role?.roleName || 'ANALYST',
      };
    } catch {
      return null;
    }
  }
}
