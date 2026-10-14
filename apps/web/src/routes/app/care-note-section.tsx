import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';

import { createCareNote, deleteCareNote, listCareNotes, type CreateCareNotePayload } from '@/api/care-notes';
import { listReferences } from '@/api/references';
import { Button } from '@/components/ui/button';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { TagChip, TagChipButton } from '@/components/ui/tag-chip';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';
import { todayString } from '@/lib/date';

/** 기록 종류는 교회가 편집하는 기준정보다. 색은 종류 id 로 정해져 상세·목록 어디서든 같다. */
function useCareNoteTypes() {
  return useQuery({ queryKey: ['references', 'careNoteType'], queryFn: () => listReferences('careNoteType') });
}

export function CareNoteSection({ memberId }: { memberId: number }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('care:write');
  const [adding, setAdding] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['care-notes', memberId],
    queryFn: () => listCareNotes(memberId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['care-notes', memberId] });
    // "내가 맡은 사람"·간사 상세의 순서가 마지막 기록일로 정해진다
    queryClient.invalidateQueries({ queryKey: ['flock'] });
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCareNote(memberId, id),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">심방·양육 기록</h3>
        {canWrite && <PanelToggle open={adding} onToggle={() => setAdding(!adding)} label="기록" />}
      </div>

      {adding && (
        <NoteForm
          memberId={memberId}
          onDone={() => {
            invalidate();
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {isLoading ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : notes.length === 0 && !adding ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">아직 기록이 없습니다. 심방·면담 내용을 남겨보세요.</p>
      ) : (
        <ul className="mt-1 space-y-3">
          {notes.map(note => (
            <li key={note.id} className="rounded-xl border border-[var(--color-border)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TagChip name={note.typeName ?? '(삭제된 종류)'} seed={note.typeId} />
                  <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">{note.date}</span>
                  {note.location && <span className="text-xs text-[var(--color-muted-foreground)]">· {note.location}</span>}
                </div>
                {canWrite && (
                  <button
                    onClick={() => {
                      if (window.confirm('이 기록을 삭제할까요?')) deleteMut.mutate(note.id);
                    }}
                    className="rounded-full p-0.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                    aria-label="삭제"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm">{note.content}</p>

              {note.prayerRequest && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--color-muted)] px-2.5 py-1.5 text-xs">
                  <span className="font-medium">기도제목 </span>
                  {note.prayerRequest}
                </p>
              )}
              {note.statusNote && (
                <p className="mt-1.5 whitespace-pre-wrap text-xs text-[var(--color-muted-foreground)]">
                  <span className="font-medium">상황 </span>
                  {note.statusNote}
                </p>
              )}

              <p className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">{note.recorderName ?? '작성자 미상'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteForm({ memberId, onDone, onCancel }: { memberId: number; onDone: () => void; onCancel: () => void }) {
  const today = todayString();
  const { data: types = [] } = useCareNoteTypes();
  const selectable = types.filter(item => item.isActive);
  const [typeId, setTypeId] = useState<number | null>(null);
  // 첫 렌더에는 종류 목록이 아직 없다 — 도착하면 첫 항목을 기본값으로.
  const activeTypeId = typeId ?? selectable[0]?.id ?? null;
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const createMut = useMutation({
    mutationFn: (payload: CreateCareNotePayload) => createCareNote(memberId, payload),
    onSuccess: onDone,
  });

  const submit = () => {
    if (!content.trim()) return;
    createMut.mutate({
      typeId: activeTypeId ?? undefined,
      date,
      location: location.trim() || undefined,
      content: content.trim(),
      prayerRequest: prayerRequest.trim() || undefined,
      statusNote: statusNote.trim() || undefined,
    });
  };

  return (
    <div className="mb-3 space-y-3 rounded-xl border border-dashed border-[var(--color-border)] p-3">
      <div className="flex flex-wrap gap-1.5">
        {selectable.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            기록 종류가 없습니다. 교인 화면의 “재적상태·사역 역할·기록 종류 관리”에서 먼저 등록하세요.
          </p>
        ) : (
          selectable.map(item => (
            <TagChipButton
              key={item.id}
              name={item.name}
              seed={item.id}
              onClick={() => setTypeId(item.id)}
              className={cn(item.id === activeTypeId && 'ring-1 ring-[var(--color-foreground)] ring-inset')}
            />
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-40" />
        <Input placeholder="장소 (선택)" value={location} onChange={event => setLocation(event.target.value)} />
      </div>

      <textarea
        placeholder="본문"
        value={content}
        onChange={event => setContent(event.target.value)}
        rows={3}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-foreground)]"
      />
      <textarea
        placeholder="기도제목 (선택)"
        value={prayerRequest}
        onChange={event => setPrayerRequest(event.target.value)}
        rows={2}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-foreground)]"
      />
      <textarea
        placeholder="현재 상황 (선택)"
        value={statusNote}
        onChange={event => setStatusNote(event.target.value)}
        rows={2}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-foreground)]"
      />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button size="sm" onClick={submit} disabled={!content.trim() || createMut.isPending}>
          저장
        </Button>
      </div>
    </div>
  );
}
