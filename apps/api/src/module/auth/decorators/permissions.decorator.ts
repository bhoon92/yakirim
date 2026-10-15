import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import type { Permission } from '../permissions';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * 핸들러/컨트롤러에 필요한 권한 지정. 모두 충족해야 통과.
 * 지정한 권한이 Swagger 403 응답 설명에 그대로 노출되므로 문서와 실제 검사가 어긋날 수 없다.
 */
export const Permissions = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    ApiForbiddenResponse({
      description: `권한 부족 — 필요 권한: ${permissions.join(', ')} (또는 활성 교회 미선택)`,
    })
  );
