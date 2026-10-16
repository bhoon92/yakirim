import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Pencil, Phone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { assignAffiliation, type AffiliationKind, endAffiliation, setAffiliationLeader } from '@/api/affiliations';
import { fetchMember, updateMember, type AffiliationSummary, type PositionHistoryEntry } from '@/api/members';
import { endCurrentPosition, promotePosition } from '@/api/positions';
import { listResidents } from '@/api/residents';
import { fetchMemberShepherd, setMemberShepherd } from '@/api/shepherds';
import { listReferences, type Reference } from '@/api/references';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TagChip, TagChipButton } from '@/components/ui/tag-chip';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { cn } from '@/lib/utils';
import { useOrgLabels } from '@/lib/org-labels';
import { usePermissions } from '@/lib/permissions';
import { CareNoteSection } from './care-note-section';
import { MemberJourneySection } from './member-journey-section';
import { ReceiptSection } from './receipt-section';
import { isSubmitEnter } from '@/lib/keyboard';

const KINDS: AffiliationKind[] = ['department', 'ministry', 'smallGroup', 'table'];

export function MemberDetailModal({ memberId, onClose }: { memberId: number; onClose: () => void }) {
  const { data: member, isLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: () => fetchMember(memberId),
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-[var(--color-background)] shadow-md"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            {isLoading || !member ? (
              <div className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <EditableName memberId={memberId} name={member.name} />
                  <EditableStatus memberId={memberId} statusName={member.statusName} />
                </div>
                <EditablePhone memberId={memberId} phone={member.phone} />
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {member && (
            <>
              {/*
               * 순서 = 이 사람을 볼 때 실제로 보는 순서.
               * 교인 대부분은 훈련도 파송도 없는 평신도라서, 예전처럼 양성 경로를 맨 위에 두면
               * 카드를 열 때마다 "파송 트랙에 등록되지 않은 교인입니다" 부터 보였다.
               * 지금은 "무엇을 섬기는가 → 무슨 이야기를 나눴나" 가 먼저 오고,
               * 훈련·파송은 해당되는 사람에게만 아래에서 보인다.
               */}
              <PositionSection memberId={memberId} current={member.position.current} history={member.position.history} />

              <AffiliationsSection memberId={memberId} affiliations={member.affiliations} />

              <ShepherdSection memberId={memberId} />

              <div className="border-t border-[var(--color-border)] pt-5">
                <CareNoteSection memberId={memberId} />
              </div>

              <div className="border-t border-[var(--color-border)] pt-5">
                <MemberJourneySection memberId={memberId} />
              </div>

              <div className="border-t border-[var(--color-border)] pt-5">
                <ReceiptSection memberId={memberId} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditableName({ memberId, name }: { memberId: number; name: string }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('member:write');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const cancelRef = useRef(false);

  const mutation = useMutation({
    mutationFn: (newName: string) => updateMember(memberId, { name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error: Error) => window.alert(`이름 수정 실패: ${error.message}`),
  });

  // blur 한 곳에서만 커밋(Enter는 blur로 수렴). Escape는 취소 + 모달 닫힘 방지(stopPropagation).
  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    if (trimmed && trimmed !== name) mutation.mutate(trimmed);
  };

  if (!canWrite) return <h2 className="text-xl font-semibold tracking-tight">{name}</h2>;

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={40}
        onChange={event => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (isSubmitEnter(event)) event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.stopPropagation();
            cancelRef.current = true;
            event.currentTarget.blur();
          }
        }}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-0.5 text-xl font-semibold tracking-tight"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(name);
        setEditing(true);
      }}
      className="group inline-flex items-center gap-1.5"
      title="이름 수정"
    >
      <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
      <Pencil className="size-3.5 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function EditablePhone({ memberId, phone }: { memberId: number; phone: string | null }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('member:write');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? '');
  const cancelRef = useRef(false);

  const mutation = useMutation({
    mutationFn: (newPhone: string) => updateMember(memberId, { phone: newPhone || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (error: Error) => window.alert(`전화번호 수정 실패: ${error.message}`),
  });

  const commit = () => {
    setEditing(false);
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const trimmed = value.trim();
    if (trimmed !== (phone ?? '')) mutation.mutate(trimmed);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={30}
        inputMode="tel"
        placeholder="010-1234-5678"
        onChange={event => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (isSubmitEnter(event)) event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.stopPropagation();
            cancelRef.current = true;
            event.currentTarget.blur();
          }
        }}
        className="mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-0.5 text-xs"
      />
    );
  }

  if (!canWrite) {
    return phone ? (
      <div className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
        <Phone className="size-3" />
        {phone}
      </div>
    ) : null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(phone ?? '');
        setEditing(true);
      }}
      className="group mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      title="전화번호 수정"
    >
      <Phone className="size-3" />
      {phone ?? '전화번호 추가'}
      <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function EditableStatus({ memberId, statusName }: { memberId: number; statusName: string | null }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('member:write');
  const [open, setOpen] = useState(false);

  const { data: statuses = [] } = useQuery({
    queryKey: ['references', 'memberStatus'],
    queryFn: () => listReferences('memberStatus'),
    enabled: open,
  });
  const activeStatuses = statuses.filter(status => status.isActive);

  const mutation = useMutation({
    mutationFn: (statusId: number) => updateMember(memberId, { statusId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', memberId] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setOpen(false);
    },
    onError: (error: Error) => window.alert(`재적상태 수정 실패: ${error.message}`),
  });

  if (!canWrite) return <Badge tone="muted">{statusName ?? '—'}</Badge>;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(value => !value)} className="inline-flex items-center gap-0.5" title="재적상태 변경">
        <Badge tone="muted">{statusName ?? '—'}</Badge>
        <ChevronDown className="size-3 text-[var(--color-muted-foreground)]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 min-w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-1 shadow-md">
            {activeStatuses.map(status => (
              <button
                key={status.id}
                type="button"
                onClick={() => mutation.mutate(status.id)}
                className={cn(
                  'block w-full rounded-md px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-muted)]',
                  status.name === statusName && 'font-semibold'
                )}
              >
                {status.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function affiliationsByKind(
  affiliations: {
    departments: AffiliationSummary[];
    ministries: AffiliationSummary[];
    smallGroups: AffiliationSummary[];
    tables: AffiliationSummary[];
  },
  kind: AffiliationKind
): AffiliationSummary[] {
  switch (kind) {
    case 'department':
      return affiliations.departments;
    case 'ministry':
      return affiliations.ministries;
    case 'smallGroup':
      return affiliations.smallGroups;
    case 'table':
      return affiliations.tables;
  }
}

/**
 * 소속 — 기관·사역팀·공동체·테이블을 한 칸에.
 * 예전에는 종류마다 칸을 따로 둬서 소속이 없는 대부분의 교인에게 "소속 없음"이 세 번 떴고,
 * 폰에서는 그 아래 양육기록(간사가 가장 자주 쓰는 곳)이 스크롤 밖으로 밀렸다.
 * 있는 종류만 한 줄씩 보여주고, 추가할 때 종류를 고른다.
 */
function AffiliationsSection({
  memberId,
  affiliations,
}: {
  memberId: number;
  affiliations: {
    departments: AffiliationSummary[];
    ministries: AffiliationSummary[];
    smallGroups: AffiliationSummary[];
    tables: AffiliationSummary[];
  };
}) {
  const orgLabels = useOrgLabels();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('member:write');
  const [adding, setAdding] = useState(false);
  const [addKind, setAddKind] = useState<AffiliationKind>('ministry');
  const currentYear = new Date().getFullYear();

  const { data: references = [] } = useQuery({
    queryKey: ['references', addKind, currentYear],
    queryFn: () => listReferences(addKind, currentYear),
    enabled: adding,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['member', memberId] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['residents'] });
  };

  const assignMut = useMutation({
    mutationFn: (referenceId: number) => assignAffiliation(memberId, addKind, { referenceId }),
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
    onError: (error: Error) => alert(`소속 추가 실패: ${error.message}`),
  });

  const endMut = useMutation({
    mutationFn: ({ kind, referenceId }: { kind: AffiliationKind; referenceId: number }) => endAffiliation(memberId, kind, referenceId),
    onSuccess: invalidate,
    onError: (error: Error) => alert(`소속 종료 실패: ${error.message}`),
  });

  const leaderMut = useMutation({
    mutationFn: ({ kind, referenceId, isLeader }: { kind: AffiliationKind; referenceId: number; isLeader: boolean }) =>
      setAffiliationLeader(memberId, kind, referenceId, isLeader),
    onSuccess: invalidate,
    onError: (error: Error) => alert(`리더 설정 실패: ${error.message}`),
  });

  const filled = KINDS.map(kind => ({ kind, items: affiliationsByKind(affiliations, kind) })).filter(row => row.items.length > 0);
  const assignedIds = new Set(affiliationsByKind(affiliations, addKind).map(item => item.referenceId));
  const available = references.filter((reference: Reference) => !assignedIds.has(reference.id));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">소속</h3>
        {canWrite && <PanelToggle open={adding} onToggle={() => setAdding(!adding)} label="추가" />}
      </div>

      {filled.length === 0 && !adding && <span className="text-xs text-[var(--color-muted-foreground)]">소속 없음</span>}
      <div className="space-y-1.5">
        {filled.map(row => (
          <div key={row.kind} className="flex items-start gap-2">
            <span className="w-14 shrink-0 pt-1 text-xs text-[var(--color-muted-foreground)]">{orgLabels[row.kind]}</span>
            <div className="flex flex-wrap gap-1.5">
              {row.items.map(affiliation => (
                <AffiliationChip
                  key={affiliation.id}
                  label={affiliation.referenceName ?? '(이름 없음)'}
                  seed={affiliation.referenceId}
                  leader={affiliation.isLeader}
                  canWrite={canWrite}
                  onToggleLeader={() =>
                    leaderMut.mutate({ kind: row.kind, referenceId: affiliation.referenceId, isLeader: !affiliation.isLeader })
                  }
                  onRemove={() => endMut.mutate({ kind: row.kind, referenceId: affiliation.referenceId })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-dashed border-[var(--color-border)] p-3">
          <div className="flex gap-1">
            {KINDS.map(kind => (
              <button
                key={kind}
                onClick={() => setAddKind(kind)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  addKind === kind
                    ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                )}
              >
                {orgLabels[kind]}
              </button>
            ))}
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              추가 가능한 {orgLabels[addKind]}이 없습니다. 조직도에서 먼저 만드세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map(reference => (
                <TagChipButton
                  key={reference.id}
                  name={reference.name}
                  seed={reference.id}
                  prefix="+"
                  disabled={assignMut.isPending}
                  onClick={() => assignMut.mutate(reference.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AffiliationChip({
  label,
  seed,
  leader,
  canWrite,
  onToggleLeader,
  onRemove,
}: {
  label: string;
  seed: number;
  leader: boolean;
  canWrite: boolean;
  onToggleLeader: () => void;
  onRemove: () => void;
}) {
  return (
    <TagChip
      name={label}
      seed={seed}
      // 리더는 색이 아니라 테두리로 구분한다 — 색은 이미 "어느 조직인지"를 나타내고 있어서
      // 리더까지 색으로 표시하면 두 정보가 같은 채널에서 부딪힌다.
      className={cn(leader && 'ring-1 ring-[var(--color-foreground)] ring-inset')}
      prefix={
        canWrite ? (
          <button
            onClick={onToggleLeader}
            aria-label={leader ? '리더 해제' : '리더 지정'}
            title={leader ? '리더 해제' : '리더 지정'}
            className={cn('text-[10px] leading-none transition-opacity', leader ? 'opacity-100' : 'opacity-40 hover:opacity-100')}
          >
            ★
          </button>
        ) : (
          leader && <span className="text-[10px] leading-none">★</span>
        )
      }
      suffix={
        canWrite && (
          <button onClick={onRemove} className="rounded-full p-0.5 transition-colors hover:bg-black/10" aria-label="종료">
            <X className="size-3" />
          </button>
        )
      }
    />
  );
}

function PositionSection({
  memberId,
  current,
  history,
}: {
  memberId: number;
  current: PositionHistoryEntry | null;
  history: PositionHistoryEntry[];
}) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('member:write');
  const [picking, setPicking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: positions = [] } = useQuery({
    queryKey: ['references', 'position'],
    queryFn: () => listReferences('position'),
    enabled: picking,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['member', memberId] });
    queryClient.invalidateQueries({ queryKey: ['members'] });
  };

  const promoteMut = useMutation({
    mutationFn: (positionId: number) => promotePosition(memberId, { positionId }),
    onSuccess: () => {
      invalidate();
      setPicking(false);
    },
  });

  const endMut = useMutation({
    mutationFn: () => endCurrentPosition(memberId),
    onSuccess: invalidate,
  });

  const previousHistory = history.filter(historyRecord => !historyRecord.isCurrent);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">사역 역할</h3>
        {canWrite && <PanelToggle open={picking} onToggle={() => setPicking(!picking)} label={current ? '변경' : '임명'} />}
      </div>

      <div className="flex items-center gap-2">
        {current ? (
          <>
            <TagChip name={current.positionName ?? '(이름 없음)'} seed={current.positionId} />
            <span className="text-xs text-[var(--color-muted-foreground)]">{current.startDate} ~</span>
            {canWrite && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm('현재 역할을 종료할까요?')) endMut.mutate();
                }}
                className="text-xs text-[var(--color-muted-foreground)]"
              >
                종료
              </Button>
            )}
          </>
        ) : (
          <span className="text-xs text-[var(--color-muted-foreground)]">현재 역할 없음</span>
        )}
      </div>

      {picking && (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-3">
          {positions.length === 0 ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">등록된 사역 역할이 없습니다. 먼저 설정에서 등록하세요.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {positions
                .filter((position: Reference) => position.id !== current?.positionId)
                .map(position => (
                  <TagChipButton
                    key={position.id}
                    name={position.name}
                    seed={position.id}
                    prefix="→"
                    disabled={promoteMut.isPending}
                    onClick={() => promoteMut.mutate(position.id)}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {previousHistory.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            {showHistory ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            이전 역할 ({previousHistory.length})
          </button>

          {showHistory && (
            <ul className="mt-2 space-y-1 pl-4 text-xs text-[var(--color-muted-foreground)]">
              {previousHistory.map(historyRecord => (
                <li key={historyRecord.id}>
                  {historyRecord.positionName ?? '(이름 없음)'} ·{' '}
                  <span className="tabular-nums">
                    {historyRecord.startDate} ~ {historyRecord.endDate}
                  </span>
                  {historyRecord.note && <span> · {historyRecord.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 담당 간사 — 이 성도를 누가 맡아 양육하는지. 한 명만 둔다.
 * 바꾸면 이전 담당 구간이 닫혀 이력으로 남는다 (재적상태 이력과 같은 방식).
 */
function ShepherdSection({ memberId }: { memberId: number }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('member:write');

  const { data } = useQuery({ queryKey: ['member', memberId, 'shepherd'], queryFn: () => fetchMemberShepherd(memberId) });
  const { data: residents = [] } = useQuery({
    queryKey: ['residents', 'for-shepherd'],
    queryFn: () => listResidents({ scope: 'active' }),
    enabled: canWrite,
  });

  const setMut = useMutation({
    mutationFn: (residentId: number | null) => setMemberShepherd(memberId, residentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member', memberId, 'shepherd'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      queryClient.invalidateQueries({ queryKey: ['flock'] });
    },
    onError: (error: Error) => alert(`담당 변경 실패: ${error.message}`),
  });

  const current = data?.current ?? null;
  const past = (data?.history ?? []).filter(row => row.endDate !== null);
  // 자기 자신은 자기 담당이 될 수 없다. 지금 담당이 공동체를 떠났어도 선택지에는 남긴다.
  const options = residents.filter(resident => resident.memberId !== memberId);
  const currentMissing = current && !options.some(resident => resident.id === current.residentId);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">담당 간사</h3>
      <div className="flex flex-wrap items-center gap-2">
        {canWrite ? (
          <select
            value={current?.residentId ?? ''}
            disabled={setMut.isPending}
            onChange={event => setMut.mutate(event.target.value === '' ? null : Number(event.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm"
          >
            <option value="">담당 없음</option>
            {currentMissing && <option value={current.residentId}>{current.residentName}</option>}
            {options.map(resident => (
              <option key={resident.id} value={resident.id}>
                {resident.memberName}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm">{current?.residentName ?? '담당 없음'}</span>
        )}
        {current && <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">{current.startDate}부터</span>}
      </div>
      {past.length > 0 && (
        <p className="mt-1.5 text-[11px] text-[var(--color-muted-foreground)]">
          이전 담당 ·{' '}
          {past
            .slice(0, 3)
            .map(row => `${row.residentName ?? '(삭제된 간사)'} (${row.startDate} ~ ${row.endDate})`)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}
