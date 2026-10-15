export type Church = {
  id: number;
  name: string;
  representative: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  fiscalYearStartMonth: number;
  status: 'active' | 'trial' | 'suspended';
  departmentLabel: string | null;
  ministryLabel: string | null;
  smallGroupLabel: string | null;
};

export async function fetchCurrentChurch(): Promise<Church> {
  const res = await fetch('/api/churches/me', { credentials: 'include' });
  if (!res.ok) throw new Error(`churches/me ${res.status}`);
  return res.json();
}

/**
 * 조직 대분류의 교회별 표시 이름 변경.
 * 빈 문자열을 보내면 기본값(기관/사역팀/공동체)으로 되돌아간다.
 * 저장 후에는 /auth/me 를 다시 읽어야 앱 전체에 반영된다 (라벨이 currentChurch 로 내려오므로).
 */
export async function updateOrganizationLabels(
  payload: Partial<{ departmentLabel: string | null; ministryLabel: string | null; smallGroupLabel: string | null }>
): Promise<Church> {
  const res = await fetch('/api/churches/me/organization-labels', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`update organization labels ${res.status} ${text}`);
  }
  return res.json();
}
