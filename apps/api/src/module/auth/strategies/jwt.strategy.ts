import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigProvider } from '@src/config';
import type { AuthContext, JwtPayload } from '../types/auth-context';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: ConfigProvider.jwt.access.secret,
    });
  }

  validate(payload: JwtPayload): AuthContext {
    if (typeof payload.accountId !== 'number') {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      accountId: payload.accountId,
      churchId: payload.churchId ?? null,
      role: payload.role ?? null,
    };
  }
}
