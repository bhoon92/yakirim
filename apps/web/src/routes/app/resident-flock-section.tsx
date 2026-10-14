import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';

import { listMembers } from '@/api/members';
import { assignFlock, fetchFlock, setMemberShepherd } from '@/api/shepherds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/** 이 날수 넘게 양육기록이 없으면 눈에 띄게 한다. 교회 설정으로 뺄 만큼 확정된 숫자는 아니라 여기 둔다. */
const QUIET_DAYS = 30;

/**
 * 간사가 맡은 성도 — 연락한 지 오래된 사람이 위로 온다(서버 정렬).
 * 맡기기는 여러 명을 한 번에, 다른 간사 담당이던 사람은 옮겨온다.
 */
export function ResidentFlockSection({
  residentId,
  residentMemberId,
  onOpenMember,
}: {
  residentId: number;
  /** 간사 자신 — 자기 담당 후보에서 뺀다 */
  residentMemberId: number;
  onOpenMember: (memberId: number) => void;
}) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('member:write');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number[]>([]);

  const { data: flock = [], isLoading } = useQuery({ queryKey: ['flock', residentId], queryFn: () => fetchFlock(residentId) });
  const { data: found } = useQuery({
    queryKey: ['members', 'for-flock', query],
    queryFn: () => listMembers({ q: query || undefined, pageSize: 20 }),
    enabled: adding,
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['flock'] });
    queryClient.invalidateQueries({ queryKey: ['residents'] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['member'] });
  };

  const assignMut = useMutation({
    mutationFn: () => assignFlock(residentId, picked),
    onSuccess: () => {
      setPicked([]);
      setQuery('');
      setAdding(false);
      invalidate();
    },
    onError: (error: Error) => window.alert(`맡기기 실패: ${error.message}`),
  });

  const releaseMut = useMutation({
    mutationFn: (memberId: number) => setMemberShepherd(memberId, null),
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`담당 해제 실패: ${error.message}`),
  });

  const inFlock = new Set(flock.map(row => row.memberId));
  const candidates = (found?.items ?? []).filter(member => !inFlock.has(member.id) && member.id !== residentMemberId);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          맡은 성도 <span className="font-normal text-[var(--color-muted-foreground)] tabular-nums">{flock.length}명</span>
        </h3>
        {canWrite && <PanelToggle open={adding} onToggle={() => setAdding(!adding)} label="맡기기" />}
      </div>

      {adding && (
        <div className="space-y-2 rounded-xl border border-dashed border-[var(--color-border)] p-3">
          <Input placeholder="교인 이름으로 검색" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
          <div className="h-[96px] overflow-y-auto rounded-md bg-[var(--color-muted)] p-2">
            {candidates.length === 0 ? (
              <p className="py-2 text-center text-xs text-[var(--color-muted-foreground)]">
                {query ? '검색 결과가 없습니다.' : '맡길 교인을 검색하세요.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {candidates.map(member => {
                  const on = picked.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => setPicked(on ? picked.filter(id => id !== member.id) : [...picked, member.id])}
                      title={member.shepherd ? `지금 담당: ${member.shepherd.name} — 맡기면 옮겨옵니다` : undefined}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        on
                          ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                          : 'border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-accent)]'
                      )}
                    >
                      {member.name}
                      {member.shepherd && <span className="ml-1 opacity-60">· {member.shepherd.name}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => assignMut.mutate()} disabled={picked.length === 0 || assignMut.isPending}>
              {picked.length}명 맡기기
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : flock.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">맡은 성도가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {flock.map(row => {
            const quiet = row.daysSinceContact >= QUIET_DAYS;
            return (
              <li key={row.memberId} className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => onOpenMember(row.memberId)} className="min-w-0 flex-1 text-left">
                  <span className="text-sm font-medium hover:underline">{row.memberName}</span>
                  <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">{row.statusName}</span>
                </button>
                <span
                  className={cn(
                    'shrink-0 text-xs tabular-nums',
                    quiet ? 'font-semibold text-[#8a5700]' : 'text-[var(--color-muted-foreground)]'
                  )}
                  title={row.lastCareNoteDate ? `마지막 양육기록 ${row.lastCareNoteDate}` : `기록 없음 · ${row.since}부터 담당`}
                >
                  {row.lastCareNoteDate ? `기록 ${row.daysSinceContact}일 전` : `기록 없음 · ${row.daysSinceContact}일째`}
                </span>
                {canWrite && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(`${row.memberName} 님을 맡은 성도에서 뺄까요?\n담당 없음이 되고, 맡았던 기간은 이력에 남습니다.`)
                      ) {
                        releaseMut.mutate(row.memberId);
                      }
                    }}
                    className="rounded-full p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                    aria-label={`${row.memberName} 담당 해제`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
