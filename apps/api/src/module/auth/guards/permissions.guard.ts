import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { Permission } from '../permissions';
import { roleHasPermission } from '../permissions';
import type { AuthContext } from '../types/auth-context';

/**
 * @Permissions 메타데이터를 읽어 현재 멤버십 role 이 권한을 가지는지 검사.
 * JwtAuthGuard 뒤에 실행되어야 함 (req.user 필요): @UseGuards(JwtAuthGuard, PermissionsGuard).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthContext }>();
    const role = req.user?.role ?? null;

    const missing = required.filter(permission => !roleHasPermission(role, permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`권한이 없습니다 (${missing.join(', ')})`);
    }
    return true;
  }
}
