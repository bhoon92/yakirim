/**
 * 기록 종류는 이제 기준정보다 — `listReferences('careNoteType')` 로 읽는다.
 * 예전 enum(CareNoteType)과 하드코딩 라벨·색은 제거했다. 색은 종류 id 로 정한다(TagChip).
 */
export type CareNote = {
  id: number;
  typeId: number;
  typeName: string | null;
  date: string;
  location: string | null;
  content: string;
  prayerRequest: string | null;
  statusNote: string | null;
  recorderAccountId: number;
  recorderName: string | null;
  createdAt: string;
};

export type CreateCareNotePayload = {
  typeId?: number;
  date?: string;
  location?: string;
  content: string;
  prayerRequest?: string;
  statusNote?: string;
};

export async function listCareNotes(memberId: number): Promise<CareNote[]> {
  const res = await fetch(`/api/members/${memberId}/care-notes`, { credentials: 'include' });
  if (!res.ok) throw new Error(`list care notes ${res.status}`);
  return res.json();
}

export async function createCareNote(memberId: number, payload: CreateCareNotePayload): Promise<CareNote> {
  const res = await fetch(`/api/members/${memberId}/care-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`create care note ${res.status} ${text}`);
  }
  return res.json();
}

export async function deleteCareNote(memberId: number, id: number): Promise<void> {
  const res = await fetch(`/api/members/${memberId}/care-notes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`delete care note ${res.status}`);
}
