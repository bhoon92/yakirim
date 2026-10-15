import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

import {
  assignResidentDuty,
  deleteResidentDuty,
  listResidentDuties,
  renameResidentDuty,
  unassignResidentDuty,
  type ResidentDuty,
} from '@/api/residents';
import { TagChip } from '@/components/ui/tag-chip';
import { cn } from '@/lib/utils';
import { isSubmitEnter } from '@/lib/keyboard';

/** 사역팀·하우스 태그와 색이 겹쳐도 같은 것으로 읽히지 않게 seed 에 접두어를 붙인다. */
const dutySeed = (id: number) => `duty-${id}`;

/**
 * 맡은 사역 — 노션 다중 선택처럼 쓴다.
 * 칸을 열어 이름을 적고 Enter 를 누르면 없던 사역은 그 자리에서 만들어 붙이고, 있던 건 목록에서 눌러 붙였다 뗀다.
 * 옵션 이름 바꾸기·지우기도 같은 칸에서 한다 (지우면 붙어 있던 모든 간사에게서 빠진다).
 *
 * 목록 행 전체가 상세를 여는 클릭 영역이라, 이 안의 클릭은 모두 전파를 막는다.
 */
export function ResidentDutyPicker({
  residentId,
  duties,
  canWrite,
  size = 'md',
}: {
  residentId: number;
  duties: ResidentDuty[];
  canWrite: boolean;
  size?: 'sm' | 'md';
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['residents'] });
    queryClient.invalidateQueries({ queryKey: ['resident', residentId] });
    queryClient.invalidateQueries({ queryKey: ['resident', 'duties'] });
  };

  const unassignMut = useMutation({
    mutationFn: (dutyId: number) => unassignResidentDuty(residentId, dutyId),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`떼기 실패: ${error.message}`),
  });

  // 바깥을 누르면 닫는다 — 노션 속성 칸과 같은 감각
  useEffect(() => {
    if (!open) return;
    const onDown = (event: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const stop = (event: MouseEvent) => event.stopPropagation();
  const chipClass = size === 'sm' ? 'px-2 py-0.5' : undefined;

  if (!canWrite && duties.length === 0) return null;

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1" onClick={stop}>
      {duties.map(duty => (
        <TagChip
          key={duty.id}
          name={duty.name}
          seed={dutySeed(duty.id)}
          title="맡은 사역"
          className={chipClass}
          suffix={
            canWrite && (
              <button
                onClick={() => unassignMut.mutate(duty.id)}
                className="rounded-full p-0.5 transition-colors hover:bg-black/10"
                aria-label={`${duty.name} 떼기`}
              >
                <X className="size-3" />
              </button>
            )
          }
        />
      ))}
      {canWrite && (
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-foreground)] hover:text-[var(--color-foreground)]',
            size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
          )}
          aria-label="맡은 사역 추가"
        >
          <Plus className="size-3" />
          {duties.length === 0 && '맡은 사역'}
        </button>
      )}
      {open && <DutyMenu residentId={residentId} assigned={duties} onChanged={invalidate} onClose={() => setOpen(false)} />}
    </div>
  );
}

function DutyMenu({
  residentId,
  assigned,
  onChanged,
  onClose,
}: {
  residentId: number;
  assigned: ResidentDuty[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data: options = [] } = useQuery({ queryKey: ['resident', 'duties'], queryFn: listResidentDuties });

  const assignedIds = new Set(assigned.map(duty => duty.id));
  const keyword = query.trim();
  const filtered = keyword ? options.filter(option => option.name.includes(keyword)) : options;
  const exact = options.find(option => option.name === keyword);

  const assignMut = useMutation({
    mutationFn: (name: string) => assignResidentDuty(residentId, name),
    onSuccess: () => {
      setQuery('');
      onChanged();
    },
    onError: (error: Error) => window.alert(`추가 실패: ${error.message}`),
  });

  const unassignMut = useMutation({
    mutationFn: (dutyId: number) => unassignResidentDuty(residentId, dutyId),
    onSuccess: onChanged,
    onError: (error: Error) => window.alert(`떼기 실패: ${error.message}`),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameResidentDuty(id, name),
    onSuccess: onChanged,
    onError: (error: Error) => window.alert(`이름 변경 실패: ${error.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (dutyId: number) => deleteResidentDuty(dutyId),
    onSuccess: onChanged,
    onError: (error: Error) => window.alert(`삭제 실패: ${error.message}`),
  });

  const busy = assignMut.isPending || unassignMut.isPending;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // 상세 모달까지 함께 닫히지 않게 여기서 멈춘다
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onClose();
      return;
    }
    if (isSubmitEnter(event) && keyword && !busy) {
      event.preventDefault();
      if (exact && assignedIds.has(exact.id)) unassignMut.mutate(exact.id);
      else assignMut.mutate(keyword);
    }
  };

  return (
    <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1.5 shadow-md">
      <input
        autoFocus
        value={query}
        onChange={event => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="사역 검색 또는 새로 만들기"
        className="w-full rounded-md bg-[var(--color-muted)] px-2.5 py-1.5 text-sm outline-none"
      />
      <ul className="mt-1 max-h-60 overflow-y-auto">
        {filtered.map(option => {
          const on = assignedIds.has(option.id);
          return (
            <li key={option.id} className="group flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-[var(--color-muted)]">
              <button
                disabled={busy}
                onClick={() => (on ? unassignMut.mutate(option.id) : assignMut.mutate(option.name))}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">{on && <Check className="size-3.5" />}</span>
                <TagChip name={option.name} seed={dutySeed(option.id)} className="truncate px-2 py-0.5" />
                {option.assignedCount > 0 && (
                  <span className="text-[11px] text-[var(--color-muted-foreground)] tabular-nums">{option.assignedCount}</span>
                )}
              </button>
              <button
                onClick={() => {
                  const name = window.prompt('사역 이름', option.name)?.trim();
                  if (name && name !== option.name) renameMut.mutate({ id: option.id, name });
                }}
                className="rounded p-1 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5"
                aria-label={`${option.name} 이름 바꾸기`}
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={() => {
                  const message =
                    option.assignedCount > 0
                      ? `"${option.name}" 사역을 삭제할까요?\n지금 맡고 있는 간사 ${option.assignedCount}명에게서도 함께 빠집니다.`
                      : `"${option.name}" 사역을 삭제할까요?`;
                  if (window.confirm(message)) deleteMut.mutate(option.id);
                }}
                className="rounded p-1 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5 hover:text-[var(--color-destructive)]"
                aria-label={`${option.name} 삭제`}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          );
        })}
        {keyword && !exact && (
          <li>
            <button
              disabled={busy}
              onClick={() => assignMut.mutate(keyword)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-[var(--color-muted)]"
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="truncate">
                “<strong>{keyword}</strong>” 만들기
              </span>
            </button>
          </li>
        )}
        {!keyword && options.length === 0 && (
          <li className="px-2 py-2 text-xs text-[var(--color-muted-foreground)]">이름을 적고 Enter — 사역이 바로 만들어집니다.</li>
        )}
      </ul>
    </div>
  );
}
