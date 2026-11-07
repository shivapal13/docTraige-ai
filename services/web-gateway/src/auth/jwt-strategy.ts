import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  hospitalId?: string | null;
  hospitalName?: string | null;
  tokenType?: string;
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ||
        configService.get<string>('JWT_SECRET') ||
        'default_jwt_access_secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid or expired JWT token.');
    }

    // Access token guard: Reject if a refresh token is mistakenly passed as Bearer API token
    if (payload.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('Access Denied: Refresh token cannot be used for API access.');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      hospitalId: payload.hospitalId || undefined,
      hospitalName: payload.hospitalName || undefined,
    };
  }
}
