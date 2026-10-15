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
  /** 본문에서 @ 로 언급한 교인 */
  mentions: { id: number; name: string }[];
  createdAt: string;
};

/** 다른 교인의 기록에서 이 교인이 언급된 것 (백링크) */
export type CareNoteMention = CareNote & { subjectMemberId: number; subjectName: string };

export type CreateCareNotePayload = {
  typeId?: number;
  date?: string;
  location?: string;
  content: string;
  prayerRequest?: string;
  statusNote?: string;
  mentionedMemberIds?: number[];
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

export async function listCareNoteMentions(memberId: number): Promise<CareNoteMention[]> {
  const res = await fetch(`/api/members/${memberId}/care-notes/mentions`, { credentials: 'include' });
  if (!res.ok) throw new Error(`list care note mentions ${res.status}`);
  return res.json();
}

// ── 기록 양식 ────────────────────────────
export type CareNoteTemplate = {
  id: number;
  name: string;
  typeId: number | null;
  content: string;
  prayerRequest: string | null;
  statusNote: string | null;
};

export async function listCareNoteTemplates(): Promise<CareNoteTemplate[]> {
  const res = await fetch('/api/care-note-templates', { credentials: 'include' });
  if (!res.ok) throw new Error(`list care note templates ${res.status}`);
  return res.json();
}

export async function createCareNoteTemplate(payload: Omit<CareNoteTemplate, 'id'>): Promise<CareNoteTemplate> {
  const res = await fetch('/api/care-note-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (res.status === 409) throw new Error('같은 이름의 양식이 이미 있습니다.');
  if (!res.ok) throw new Error(`create care note template ${res.status}`);
  return res.json();
}

export async function deleteCareNoteTemplate(id: number): Promise<void> {
  const res = await fetch(`/api/care-note-templates/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`delete care note template ${res.status}`);
}
