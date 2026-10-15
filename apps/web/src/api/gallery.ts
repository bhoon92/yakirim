export type ChurchEvent = {
  id: number;
  name: string;
  date: string | null;
  description: string | null;
  sortOrder: number;
  photoCount: number;
};

export type Photo = {
  id: number;
  originalName: string;
  contentType: string | null;
  size: number | null;
  url: string;
  createdAt: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} ${res.status} ${text}`);
  }
  return res.json();
}

async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
}

// ── 행사(폴더) ───────────────────────────
export const listEvents = () => getJson<ChurchEvent[]>('/api/events');
export const createEvent = (body: { name: string; date?: string; description?: string }) => postJson<ChurchEvent>('/api/events', body);
export const deleteEvent = (id: number) => del(`/api/events/${id}`);

// ── 사진 ─────────────────────────────────
export const listPhotos = (eventId: number) => getJson<Photo[]>(`/api/events/${eventId}/photos`);
export const deletePhoto = (eventId: number, photoId: number) => del(`/api/events/${eventId}/photos/${photoId}`);

/** 3단계 업로드: presign → S3 직접 PUT → confirm. */
export async function uploadPhoto(eventId: number, file: File): Promise<Photo> {
  const { key, uploadUrl } = await postJson<{ key: string; uploadUrl: string }>(`/api/events/${eventId}/photos/presign`, {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
  });

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!put.ok) throw new Error(`S3 업로드 실패 (${put.status})`);

  return postJson<Photo>(`/api/events/${eventId}/photos`, {
    key,
    originalName: file.name,
    contentType: file.type || undefined,
    size: file.size,
  });
}
