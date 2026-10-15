import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '../types/auth-context';

export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AuthContext }>();
  if (!req.user) {
    throw new ForbiddenException('Auth context missing');
  }
  return req.user;
});

/**
 * churchId 가 반드시 있어야 하는 핸들러에서 사용.
 * (예: 재적/출석/재정 등 도메인 엔드포인트)
 */
export const RequireChurch = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext & { churchId: number } => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AuthContext }>();
  if (!req.user) {
    throw new ForbiddenException('Auth context missing');
  }
  if (req.user.churchId === null) {
    throw new ForbiddenException('Church selection required');
  }
  return req.user as AuthContext & { churchId: number };
});
