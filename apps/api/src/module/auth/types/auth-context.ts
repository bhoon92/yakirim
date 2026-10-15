import { MembershipRole } from '@src/database/entities/membership.entity';

/**
 * JWT 안에 담긴 사용자 컨텍스트.
 * - churchId 가 null 이면 아직 어느 교회에도 소속되지 않은 상태 (온보딩 직전).
 * - role 은 churchId 가 있을 때만 의미 있음.
 */
export type AuthContext = {
  accountId: number;
  churchId: number | null;
  role: MembershipRole | null;
};

export type JwtPayload = AuthContext & {
  /** issued at (sec) — JWT 표준 클레임 */
  iat?: number;
  exp?: number;
};
