import { useAuth } from '@/auth/auth-context';
import type { OrganizationKind } from '@/api/organization-chart';

/**
 * 조직 대분류를 이 교회에서 부르는 이름.
 *
 * 대분류는 3종 고정이지만(각각 소속 이력 테이블·예산 배정 대상이 따로 있다) 부르는 이름은
 * 교회마다 다르다 — 부서/구역/목장/셀… 그래서 표시 이름만 교회 설정에서 바꾸고,
 * 화면은 전부 이 훅을 통해 이름을 읽는다. 한 곳만 고치면 앱이 반쪽만 바뀌기 때문이다.
 */
export const DEFAULT_ORG_LABEL: Record<OrganizationKind, string> = {
  department: '기관',
  ministry: '사역팀',
  smallGroup: '공동체',
};

export type OrgLabels = Record<OrganizationKind, string>;

export function useOrgLabels(): OrgLabels {
  const { state } = useAuth();
  const church = state.status === 'authenticated' ? state.currentChurch : null;

  return {
    department: church?.departmentLabel?.trim() || DEFAULT_ORG_LABEL.department,
    ministry: church?.ministryLabel?.trim() || DEFAULT_ORG_LABEL.ministry,
    smallGroup: church?.smallGroupLabel?.trim() || DEFAULT_ORG_LABEL.smallGroup,
  };
}

/** 예산 배정 대상(`small_group`)처럼 스네이크 키를 쓰는 곳을 위한 변환. */
export function orgKindFromBudgetKind(kind: 'department' | 'ministry' | 'small_group'): OrganizationKind {
  return kind === 'small_group' ? 'smallGroup' : kind;
}
