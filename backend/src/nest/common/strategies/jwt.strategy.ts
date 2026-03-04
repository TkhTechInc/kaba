import { Injectable, UnauthorizedException, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const secret = config?.get<string>('jwt.secret') || process.env['JWT_SECRET'] || 'dev-secret-change-in-production';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: string;
    businessId?: string;
    organizationId?: string;
    phone?: string;
    email?: string;
    role?: string;
  }): Promise<JwtPayload> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      sub: payload.sub,
      businessId: payload.businessId,
      organizationId: payload.organizationId,
      phone: payload.phone,
      email: payload.email,
      role: payload.role === 'admin' ? 'admin' : 'user',
    };
  }
}
