import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ACCESS_TOKEN_COOKIE } from '@src/module/auth/auth.constants';

/**
 * JwtAuthGuard 가 걸린 컨트롤러에 붙인다. 인증 수단(쿠키/Bearer)과 공통 실패 응답을 문서화.
 * 엔드포인트별 필요 권한은 @Permissions 데코레이터가 403 설명에 자동으로 채운다.
 */
export function ApiAuth() {
  return applyDecorators(
    ApiCookieAuth(ACCESS_TOKEN_COOKIE),
    ApiBearerAuth('access-token'),
    ApiUnauthorizedResponse({ description: '로그인 필요 — access 쿠키가 없거나 만료 (POST /auth/refresh 로 갱신)' }),
    ApiForbiddenResponse({ description: '활성 교회 미선택 (POST /auth/select-church) 또는 권한 부족' })
  );
}
