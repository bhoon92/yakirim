/** 가져오기 결과 — 행 단위 처리라 성공과 실패가 함께 온다. */
export type ImportRowError = { row: number; name: string; message: string };

export type ImportMembersResult = {
  /** 실제로 저장했는지. dryRun 이면 false */
  applied: boolean;
  /** 데이터가 있던 행 수 (머리글 제외) */
  total: number;
  created: number;
  updated: number;
  /** 바꿀 내용이 없어 건너뛴 행 */
  unchanged: number;
  errors: ImportRowError[];
};

/** 서식 내려받기 — 이 교회에서 쓸 수 있는 재적상태 목록이 '안내' 시트에 함께 들어 있다. */
export async function downloadMemberTemplate(): Promise<void> {
  const res = await fetch('/api/import/members/template', { credentials: 'include' });
  if (!res.ok) throw new Error(`서식을 받지 못했습니다 (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'members-template.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function importMembers(file: File, dryRun: boolean): Promise<ImportMembersResult> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`/api/import/members?dryRun=${dryRun}`, { method: 'POST', credentials: 'include', body });
  if (!res.ok) {
    // 서버가 이유를 한국어로 주므로(형식 오류·열 누락 등) 그대로 띄운다.
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.message ?? `가져오기 실패 (${res.status})`);
  }
  return res.json();
}
