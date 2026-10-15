import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FileSpreadsheet, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { downloadMemberTemplate, importMembers, type ImportMembersResult } from '@/api/imports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * 교인 명부 엑셀 가져오기.
 *
 * 흐름을 **미리보기 → 반영** 두 단계로 나눈 게 핵심이다. 수백 줄을 한 번에 넣는 작업이라
 * "무엇이 새로 생기고 무엇이 고쳐지는지" 를 보지 않고 누르게 하면 되돌릴 수가 없다.
 * 서버의 dryRun 이 그대로 이 미리보기다 — 같은 코드가 계산하므로 결과가 어긋나지 않는다.
 */
export function MemberImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportMembersResult | null>(null);
  const [done, setDone] = useState<ImportMembersResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const pick = async (picked: File | null) => {
    setFile(picked);
    setPreview(null);
    setDone(null);
    setError(null);
    if (!picked) return;
    setBusy(true);
    try {
      setPreview(await importMembers(picked, true));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importMembers(file, false);
      setDone(result);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const result = done ?? preview;
  const willChange = result ? result.created + result.updated : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-[var(--color-background)] shadow-md"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-base font-semibold">교인 명부 가져오기</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {!done && (
            <>
              <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--color-muted)] p-3">
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  서식의 열은 <strong>내보내기와 같습니다</strong>. 지금 쓰시는 명부가 있으면 내보내기로 받아 고친 뒤 그대로 올리셔도
                  됩니다.
                </p>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => void downloadMemberTemplate()}>
                  <Download className="size-3.5" />
                  서식
                </Button>
              </div>

              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={event => void pick(event.target.files?.[0] ?? null)}
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 transition-colors hover:bg-[var(--color-muted)] disabled:opacity-60"
                >
                  <FileSpreadsheet className="size-6 text-[var(--color-muted-foreground)]" />
                  <span className="text-sm font-medium">{file ? file.name : '.xlsx 파일 선택'}</span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {busy && !preview ? '읽는 중…' : '고르면 먼저 미리보기만 계산합니다 (저장 안 함)'}
                  </span>
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-[#ffe4dc] p-3 text-xs text-[#c32700]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{done ? '반영 완료' : '미리보기'}</h3>
                <span className="text-xs text-[var(--color-muted-foreground)]">{result.total}행</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <Tally label="새로 등록" value={result.created} tone="accent" />
                <Tally label="수정" value={result.updated} tone="info" />
                <Tally label="변화 없음" value={result.unchanged} tone="muted" />
                <Tally label="오류" value={result.errors.length} tone={result.errors.length > 0 ? 'danger' : 'muted'} />
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    아래 행은 {done ? '반영되지 않았습니다' : '건너뜁니다'}. 파일에서 고쳐 다시 올리시면 됩니다.
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-[var(--color-muted)] p-2">
                    {result.errors.map(rowError => (
                      <li key={rowError.row} className="text-xs">
                        <span className="font-semibold tabular-nums">{rowError.row}행</span>
                        {rowError.name && <span className="font-medium"> · {rowError.name}</span>}
                        <span className="text-[var(--color-muted-foreground)]"> — {rowError.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3.5">
          {done ? (
            <Button onClick={onClose}>확인</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                취소
              </Button>
              <Button onClick={() => void apply()} disabled={!preview || busy || willChange === 0}>
                {busy ? '반영 중…' : willChange > 0 ? `${willChange}건 반영` : '반영할 내용 없음'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: 'accent' | 'info' | 'muted' | 'danger' }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-2.5 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <Badge tone={tone} className="mt-1">
        {label}
      </Badge>
    </div>
  );
}
