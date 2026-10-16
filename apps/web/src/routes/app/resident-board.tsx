import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type DragEvent } from 'react';

import {
  listResidents,
  RESIDENT_PHASE_LABEL,
  updateResident,
  type Resident,
  type ResidentPhase,
  type ResidentStatus,
} from '@/api/residents';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const BOARD_KEY = ['residents', 'board'] as const;

/** 구간마다 칸 머리 색 — 진입 준비는 노랑, 간사는 초록, 떠남은 회색. */
const PHASE_TONE: Record<ResidentPhase, string> = {
  preparing: 'bg-[#fbf3db] text-[#8a5700]',
  resident: 'bg-[#e6f6e8] text-[#058012]',
  left: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
};

/**
 * 간사 트랙 보드 — 노션 칸반처럼 상태별 칸에 사람 카드. 끌어다 놓으면 상태가 바뀌고 이력이 남는다.
 * 성도와 간사는 2트랙이라 진입 준비(지원 → 면담 → 과정)를 지나 간사(활동)로 들어온다. 그때 헌신일·입주일이 채워진다.
 * 폰에서는 끌기가 안 되니 카드를 눌러 상세에서 상태를 바꾼다.
 */
export function ResidentBoard({
  statuses,
  canWrite,
  search,
  onOpen,
}: {
  statuses: ResidentStatus[];
  canWrite: boolean;
  search: string;
  onOpen: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data: residents = [], isLoading } = useQuery({ queryKey: BOARD_KEY, queryFn: () => listResidents({ scope: 'all' }) });
  const [dragging, setDragging] = useState<Resident | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const moveMut = useMutation({
    mutationFn: ({ resident, to }: { resident: Resident; to: ResidentStatus }) => updateResident(resident.id, { statusId: to.id }),
    onMutate: async ({ resident, to }) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY });
      const previous = queryClient.getQueryData<Resident[]>(BOARD_KEY);
      queryClient.setQueryData<Resident[]>(BOARD_KEY, current =>
        current?.map(row => (row.id === resident.id ? { ...row, statusId: to.id, statusName: to.name, statusPhase: to.phase } : row))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(BOARD_KEY, context.previous);
      window.alert('상태를 옮기지 못했습니다. 다시 시도해 주세요.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['residents'] });
      void queryClient.invalidateQueries({ queryKey: ['resident'] });
    },
  });

  const keyword = search.trim();
  const shown = keyword ? residents.filter(row => row.memberName.includes(keyword)) : residents;
  const columns = statuses.filter(status => status.isActive || shown.some(row => row.statusId === status.id));

  const onDrop = (event: DragEvent, to: ResidentStatus) => {
    event.preventDefault();
    setOver(null);
    if (dragging && dragging.statusId !== to.id) moveMut.mutate({ resident: dragging, to });
    setDragging(null);
  };

  if (isLoading) return <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-3">
        {columns.map((status, index) => {
          const cards = shown.filter(row => row.statusId === status.id);
          const firstOfPhase = index === 0 || columns[index - 1].phase !== status.phase;
          return (
            <section
              key={status.id}
              aria-label={`${status.name} 칸`}
              onDragOver={event => {
                if (!dragging) return;
                event.preventDefault();
                setOver(status.id);
              }}
              onDragLeave={() => setOver(current => (current === status.id ? null : current))}
              onDrop={event => onDrop(event, status)}
              className={cn(
                'flex w-60 shrink-0 flex-col rounded-xl bg-[var(--color-muted)] p-2',
                over === status.id && dragging?.statusId !== status.id && 'ring-2 ring-[var(--color-foreground)]'
              )}
            >
              <div className="h-5 px-1.5">
                {firstOfPhase && (
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', PHASE_TONE[status.phase])}>
                    {RESIDENT_PHASE_LABEL[status.phase]}
                  </span>
                )}
              </div>
              <h3 className="px-1.5 pt-1 pb-2 text-sm font-semibold">
                {status.name} <span className="font-normal text-[var(--color-muted-foreground)]">{cards.length}</span>
              </h3>
              <ul className="flex max-h-[65vh] flex-col gap-1.5 overflow-y-auto">
                {cards.map(resident => (
                  <li key={resident.id}>
                    <button
                      type="button"
                      draggable={canWrite}
                      onDragStart={event => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(resident.id));
                        setDragging(resident);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onClick={() => onOpen(resident.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg bg-[var(--color-background)] px-2.5 py-2 text-left shadow-sm',
                        canWrite && 'cursor-grab active:cursor-grabbing',
                        dragging?.id === resident.id && 'opacity-40'
                      )}
                    >
                      <Avatar name={resident.memberName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{resident.memberName}</span>
                        <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                          {status.phase === 'resident'
                            ? [
                                resident.smallGroups
                                  .map(tag => tag.name)
                                  .filter(Boolean)
                                  .join(', '),
                                resident.committedAt && `헌신 ${resident.committedAt}`,
                              ]
                                .filter(Boolean)
                                .join(' · ') || ' '
                            : status.phase === 'left'
                              ? resident.leftAt
                                ? `퇴소 ${resident.leftAt}`
                                : ' '
                              : resident.phone || ' '}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {cards.length === 0 && <li className="px-1.5 py-3 text-center text-xs text-[var(--color-muted-foreground)]">비어 있음</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
