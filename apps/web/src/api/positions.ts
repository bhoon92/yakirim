export type PositionHistoryItem = {
  id: number;
  positionId: number;
  positionName: string | null;
  startDate: string;
  endDate: string | null;
  note: string | null;
  isCurrent: boolean;
};

export type MemberPositionPayload = {
  positionId: number;
  startDate?: string;
  note?: string;
};

export async function promotePosition(memberId: number, payload: MemberPositionPayload): Promise<unknown> {
  const res = await fetch(`/api/members/${memberId}/position`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`promote ${res.status} ${text}`);
  }
  return res.json();
}

export async function endCurrentPosition(memberId: number): Promise<void> {
  const res = await fetch(`/api/members/${memberId}/position`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`end position ${res.status}`);
}
