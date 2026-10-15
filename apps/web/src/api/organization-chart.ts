export type OrganizationKind = 'department' | 'ministry' | 'smallGroup';

export const ORGANIZATION_KIND: OrganizationKind[] = ['department', 'ministry', 'smallGroup'];

export const ORGANIZATION_KIND_LABEL: Record<OrganizationKind, string> = {
  department: '기관',
  ministry: '사역팀',
  smallGroup: '공동체',
};

export type OrganizationPerson = {
  memberId: number;
  name: string;
  /** 이 조직에서의 호칭(팀장·목자 등) — 조직마다 다를 수 있다. */
  roleLabel: string | null;
  /** 현재 사역 역할 — 사람 단위라 어느 조직에서 보든 같다. */
  positionName: string | null;
  /** 재적상태(양성 파이프라인 단계). */
  statusName: string | null;
};

export type OrganizationUnit = {
  referenceId: number;
  referenceName: string;
  leader: OrganizationPerson[];
  member: OrganizationPerson[];
  total: number;
};

export type OrganizationChart = Record<OrganizationKind, OrganizationUnit[]>;

export async function fetchOrganizationChart(year: number): Promise<OrganizationChart> {
  const res = await fetch(`/api/organization-chart?year=${year}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`organization-chart ${res.status}`);
  return res.json();
}
