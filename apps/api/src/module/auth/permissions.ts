import { MembershipRole } from '@src/database/entities/membership.entity';

/**
 * 권한 매트릭스 (planning 권한 RBAC). 고정 4역할 → 권한 셋 매핑.
 * - read: 조회, write: 생성/수정/삭제.
 * - finance:write / team:manage 는 운영진(owner/admin) 만.
 * - 사역 도메인 write + settings:write 는 staff 까지.
 * - viewer 는 전부 read-only (단, care 는 민감 → 제외).
 * 커스텀 역할로 확장 시 이 맵을 DB 기반으로 교체.
 */
export type Permission =
  | 'member:read'
  | 'member:write'
  | 'finance:read'
  | 'finance:write'
  | 'attendance:read'
  | 'attendance:write'
  | 'care:read'
  | 'care:write'
  | 'training:read'
  | 'training:write'
  | 'missionary:read'
  | 'missionary:write'
  | 'resident:read'
  | 'resident:write'
  | 'calendar:read'
  | 'calendar:write'
  | 'gallery:read'
  | 'gallery:write'
  | 'settings:write'
  | 'team:manage';

const ALL_READS: Permission[] = [
  'member:read',
  'finance:read',
  'attendance:read',
  'training:read',
  'missionary:read',
  'resident:read',
  'calendar:read',
  'gallery:read',
];

const SACRED_WRITES: Permission[] = [
  'member:write',
  'attendance:write',
  'care:write',
  'training:write',
  'missionary:write',
  'resident:write',
  'calendar:write',
  'gallery:write',
  'settings:write',
];

const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  [MembershipRole.OWNER]: [...ALL_READS, 'care:read', ...SACRED_WRITES, 'finance:write', 'team:manage'],
  [MembershipRole.ADMIN]: [...ALL_READS, 'care:read', ...SACRED_WRITES, 'finance:write', 'team:manage'],
  [MembershipRole.STAFF]: [...ALL_READS, 'care:read', ...SACRED_WRITES],
  [MembershipRole.VIEWER]: [...ALL_READS],
};

export function permissionsForRole(role: MembershipRole | null): Set<Permission> {
  if (!role) return new Set();
  return new Set(ROLE_PERMISSIONS[role] ?? []);
}

export function roleHasPermission(role: MembershipRole | null, permission: Permission): boolean {
  return permissionsForRole(role).has(permission);
}
