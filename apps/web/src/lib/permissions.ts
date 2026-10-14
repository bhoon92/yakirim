import { useAuth } from '@/auth/auth-context';

/** 백엔드 permissions.ts 와 동일한 매트릭스 (UI 게이팅용). 권한 강제는 서버가 담당. */
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

export type Role = 'owner' | 'admin' | 'staff' | 'shepherd' | 'viewer';

const READS: Permission[] = [
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

/** 간사 — 현장의 쓰기만. 설정·간사·선교사 관리는 보기만 (백엔드 SHEPHERD_WRITES 와 같다). */
const SHEPHERD_WRITES: Permission[] = [
  'member:write',
  'attendance:write',
  'care:write',
  'training:write',
  'calendar:write',
  'gallery:write',
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...READS, 'care:read', ...SACRED_WRITES, 'finance:write', 'team:manage'],
  admin: [...READS, 'care:read', ...SACRED_WRITES, 'finance:write', 'team:manage'],
  staff: [...READS, 'care:read', ...SACRED_WRITES],
  shepherd: [...READS, 'care:read', ...SHEPHERD_WRITES],
  viewer: [...READS],
};

export function roleCan(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** 현재 로그인 역할 기준 권한 체크 훅. */
export function usePermissions() {
  const { state } = useAuth();
  const role = state.status === 'authenticated' ? state.role : null;
  return {
    role,
    can: (permission: Permission) => roleCan(role, permission),
  };
}
