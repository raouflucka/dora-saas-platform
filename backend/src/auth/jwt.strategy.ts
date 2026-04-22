import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: (req) => {
        let token = null;
        if (req && req.cookies) {
          token = req.cookies['access_token'];
        }
        return token || ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true }
    });
    
    // Explicitly reject if user doesn't exist or is deactivated
    if (!user || user.passwordHash === 'DEACTIVATED') {
      throw new UnauthorizedException('Invalid or deactivated session.');
    }
    
    // Completely strip secret credentials before binding to request.user
    const { passwordHash, resetToken, resetTokenExpires, ...safeUser } = user;
    
    // Map role string so guards can use req.user.role easily
    return {
        ...safeUser,
        role: user.role?.roleName || payload.role
    };
  }
}
