import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, CopyPlus, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchOrganizationChart,
  ORGANIZATION_KIND,
  type OrganizationChart,
  type OrganizationKind,
  type OrganizationPerson,
} from '@/api/organization-chart';
import { updateOrganizationLabels } from '@/api/church';
import { copyReferenceYear, createReference, deleteReference, updateReference } from '@/api/references';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { MemberDetailModal } from '@/routes/app/member-detail-modal';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/auth-context';
import { useOrgLabels } from '@/lib/org-labels';
import { usePermissions } from '@/lib/permissions';
import { isSubmitEnter } from '@/lib/keyboard';

/** 트리에서 고른 노드. kind 만 있으면 그 분류 전체, referenceId 까지 있으면 특정 조직. */
type Selection = { kind: OrganizationKind; referenceId?: number };

/** 명단 한 줄 — 한 사람이 여러 조직에 속할 수 있어 소속을 배열로 모은다. */
type RosterRow = {
  memberId: number;
  name: string;
  positionName: string | null;
  statusName: string | null;
  affiliations: { unitName: string; roleLabel: string | null; isLeader: boolean }[];
};

export function OrganizationChartPage() {
  const { can } = usePermissions();
  const orgLabels = useOrgLabels();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState('');
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['organization-chart'] });

  /** 연초 편성 — 기관·사역팀·공동체를 한 번에 작년에서 복제한다. */
  const copyYear = useMutation({
    mutationFn: async () => {
      for (const kind of ORGANIZATION_KIND) await copyReferenceYear(kind, year - 1, year);
    },
    onSuccess: invalidate,
    onError: (error: Error) => window.alert(`복제 실패: ${error.message}`),
  });

  const { data: chart, isLoading } = useQuery({
    queryKey: ['organization-chart', year],
    queryFn: () => fetchOrganizationChart(year),
  });

  /** 선택 범위 안의 사람들을 memberId 로 합쳐 명단 행을 만든다(겸직은 한 줄에 모임). */
  const roster = useMemo<RosterRow[]>(() => {
    if (!chart) return [];
    const rows = new Map<number, RosterRow>();

    const push = (person: OrganizationPerson, unitName: string, isLeader: boolean) => {
      const affiliation = { unitName, roleLabel: person.roleLabel, isLeader };
      const existing = rows.get(person.memberId);
      if (existing) {
        existing.affiliations.push(affiliation);
        return;
      }
      rows.set(person.memberId, {
        memberId: person.memberId,
        name: person.name,
        positionName: person.positionName,
        statusName: person.statusName,
        affiliations: [affiliation],
      });
    };

    for (const kind of ORGANIZATION_KIND) {
      if (selection && selection.kind !== kind) continue;
      for (const unit of chart[kind]) {
        if (selection?.referenceId && selection.referenceId !== unit.referenceId) continue;
        unit.leader.forEach(person => push(person, unit.referenceName, true));
        unit.member.forEach(person => push(person, unit.referenceName, false));
      }
    }

    const keyword = query.trim();
    const list = [...rows.values()];
    const filtered = keyword
      ? list.filter(
          row =>
            row.name.includes(keyword) ||
            row.affiliations.some(affiliation => affiliation.unitName.includes(keyword)) ||
            (row.positionName ?? '').includes(keyword)
        )
      : list;
    return filtered.sort((left, right) => left.name.localeCompare(right.name, 'ko'));
  }, [chart, selection, query]);

  const selectedLabel = useMemo(() => {
    if (!selection) return null;
    if (!selection.referenceId) return orgLabels[selection.kind];
    return chart?.[selection.kind].find(unit => unit.referenceId === selection.referenceId)?.referenceName ?? null;
  }, [chart, selection, orgLabels]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="조직"
        title="조직도"
        description="왼쪽에서 조직을 고르면 그 소속 인원이 오른쪽에 나옵니다. 편집은 교인 상세에서 합니다."
        actions={
          <>
            <select
              value={year}
              onChange={event => setYear(Number(event.target.value))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-sm"
              aria-label="편성 연도"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(option => (
                <option key={option} value={option}>
                  {option}년
                </option>
              ))}
            </select>
            {can('settings:write') && (
              <Button variant="outline" size="sm" onClick={() => copyYear.mutate()} disabled={copyYear.isPending}>
                <CopyPlus className="size-4" />
                {year - 1}년 구성 가져오기
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <OrgTree chart={chart} loading={isLoading} selection={selection} onSelect={setSelection} year={year} onChanged={invalidate} />

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
            <span className="text-sm font-semibold tabular-nums">{roster.length}명</span>
            {selectedLabel && (
              <button
                onClick={() => setSelection(null)}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--color-border)]"
              >
                {selectedLabel}
                <X className="size-3" />
              </button>
            )}
            <div className="relative ml-auto w-full max-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="이름, 조직, 역할 검색"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pr-3 pl-8 text-sm outline-none focus:border-[var(--color-foreground)]"
              />
            </div>
          </div>

          <RosterTable rows={roster} loading={isLoading} onSelect={setOpenMemberId} />
        </Card>
      </div>

      {openMemberId !== null && <MemberDetailModal memberId={openMemberId} onClose={() => setOpenMemberId(null)} />}
    </div>
  );
}

function OrgTree({
  chart,
  loading,
  selection,
  onSelect,
  year,
  onChanged,
}: {
  chart: OrganizationChart | undefined;
  loading: boolean;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  year: number;
  onChanged: () => void;
}) {
  const { can } = usePermissions();
  const { refresh: refreshAuth } = useAuth();
  const orgLabels = useOrgLabels();
  const canEdit = can('settings:write');
  const [collapsed, setCollapsed] = useState<Set<OrganizationKind>>(new Set());
  /** 지금 이름을 고치고 있는 조직 / 새 조직을 추가 중인 분류 / 이름을 고치고 있는 대분류. 동시에 하나만. */
  const [editing, setEditing] = useState<{ kind: OrganizationKind; referenceId: number } | null>(null);
  const [adding, setAdding] = useState<OrganizationKind | null>(null);
  const [renamingKind, setRenamingKind] = useState<OrganizationKind | null>(null);

  /**
   * 대분류(기관·사역팀·공동체) 이름 변경 — 조직 하나가 아니라 이 교회가 그 분류를 부르는 말이다.
   * 저장 후 /auth/me 를 다시 읽어야 앱 전체(교인 소속·예산 대상)에 반영된다.
   */
  const renameKindMut = useMutation({
    mutationFn: (vars: { kind: OrganizationKind; name: string }) =>
      updateOrganizationLabels({ [`${vars.kind}Label`]: vars.name } as Record<string, string>),
    onSuccess: async () => {
      setRenamingKind(null);
      await refreshAuth();
    },
    onError: (error: Error) => window.alert(`대분류 이름 수정 실패: ${error.message}`),
  });

  const createMut = useMutation({
    mutationFn: (vars: { kind: OrganizationKind; name: string }) => createReference(vars.kind, { name: vars.name }, year),
    onSuccess: () => {
      setAdding(null);
      onChanged();
    },
    onError: (error: Error) => window.alert(`추가 실패: ${error.message}`),
  });

  const renameMut = useMutation({
    mutationFn: (vars: { kind: OrganizationKind; id: number; name: string }) => updateReference(vars.kind, vars.id, { name: vars.name }),
    onSuccess: () => {
      setEditing(null);
      onChanged();
    },
    onError: (error: Error) => window.alert(`수정 실패: ${error.message}`),
  });

  const removeMut = useMutation({
    mutationFn: (vars: { kind: OrganizationKind; id: number }) => deleteReference(vars.kind, vars.id),
    onSuccess: onChanged,
    onError: (error: Error) => window.alert(`삭제 실패: ${error.message}`),
  });

  const toggle = (kind: OrganizationKind) =>
    setCollapsed(previous => {
      const next = new Set(previous);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  /** 겸직이 있어 단순 합산은 부풀려진다 — 고유 인원으로 센다. */
  const totalPeople = useMemo(() => {
    if (!chart) return 0;
    const ids = new Set<number>();
    for (const kind of ORGANIZATION_KIND) {
      for (const unit of chart[kind]) {
        unit.leader.forEach(person => ids.add(person.memberId));
        unit.member.forEach(person => ids.add(person.memberId));
      }
    }
    return ids.size;
  }, [chart]);

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardContent className="p-4">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            'mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-[var(--color-muted)]',
            selection === null && 'bg-[var(--color-muted)]'
          )}
        >
          전체 구성원
          <span className="text-xs font-medium tabular-nums text-[var(--color-muted-foreground)]">{totalPeople}</span>
        </button>

        {loading ? (
          <p className="px-2 py-4 text-xs text-[var(--color-muted-foreground)]">불러오는 중…</p>
        ) : (
          <div className="space-y-1">
            {ORGANIZATION_KIND.map(kind => {
              const units = chart?.[kind] ?? [];
              const isCollapsed = collapsed.has(kind);
              const kindSelected = selection?.kind === kind && !selection.referenceId;

              return (
                <div key={kind}>
                  {renamingKind === kind ? (
                    <InlineNameInput
                      initial={orgLabels[kind]}
                      pending={renameKindMut.isPending}
                      onSubmit={name => renameKindMut.mutate({ kind, name })}
                      onCancel={() => setRenamingKind(null)}
                    />
                  ) : (
                    <div className="group/kind flex items-center">
                      <button
                        onClick={() => toggle(kind)}
                        className="rounded p-0.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                        aria-label={isCollapsed ? '펼치기' : '접기'}
                      >
                        {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                      <button
                        onClick={() => onSelect({ kind })}
                        className={cn(
                          'flex flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-[var(--color-muted)]',
                          kindSelected && 'bg-[var(--color-muted)]'
                        )}
                      >
                        {orgLabels[kind]}
                        <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">{units.length}</span>
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setAdding(kind);
                            setCollapsed(previous => {
                              const next = new Set(previous);
                              next.delete(kind);
                              return next;
                            });
                          }}
                          className="ml-0.5 rounded p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                          aria-label={`${orgLabels[kind]} 추가`}
                          title={`${orgLabels[kind]} 추가`}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => setRenamingKind(kind)}
                          className="rounded p-1 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover/kind:opacity-100 focus:opacity-100 hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                          aria-label={`${orgLabels[kind]} 이름 수정`}
                          title="대분류 이름 수정"
                        >
                          <Pencil className="size-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {!isCollapsed && (
                    <div className="mt-0.5 ml-4 space-y-0.5 border-l border-[var(--color-border)] pl-2">
                      {units.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-[var(--color-muted-foreground)]">등록된 조직 없음</p>
                      ) : (
                        units.map(unit => {
                          const active = selection?.kind === kind && selection.referenceId === unit.referenceId;
                          const isEditing = editing?.kind === kind && editing.referenceId === unit.referenceId;

                          if (isEditing) {
                            return (
                              <InlineNameInput
                                key={unit.referenceId}
                                initial={unit.referenceName}
                                pending={renameMut.isPending}
                                onSubmit={name => renameMut.mutate({ kind, id: unit.referenceId, name })}
                                onCancel={() => setEditing(null)}
                              />
                            );
                          }

                          return (
                            <div key={unit.referenceId} className="group/row flex items-center">
                              <button
                                onClick={() => onSelect({ kind, referenceId: unit.referenceId })}
                                className={cn(
                                  'flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-muted)]',
                                  active
                                    ? 'bg-[var(--color-muted)] font-semibold'
                                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                                )}
                              >
                                <span className="truncate">{unit.referenceName}</span>
                                <span className="ml-2 shrink-0 text-xs tabular-nums text-[var(--color-muted-foreground)]">
                                  {unit.total}
                                </span>
                              </button>
                              {canEdit && (
                                <span className="flex shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                                  <button
                                    onClick={() => setEditing({ kind, referenceId: unit.referenceId })}
                                    className="rounded p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                                    aria-label={`${unit.referenceName} 이름 수정`}
                                    title="이름 수정"
                                  >
                                    <Pencil className="size-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const warning =
                                        unit.total > 0
                                          ? `"${unit.referenceName}" 에 ${unit.total}명이 소속돼 있습니다. 삭제할까요?\n(소속 이력은 남고 조직만 사라집니다)`
                                          : `"${unit.referenceName}" 을(를) 삭제할까요?`;
                                      if (window.confirm(warning)) removeMut.mutate({ kind, id: unit.referenceId });
                                    }}
                                    className="rounded p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
                                    aria-label={`${unit.referenceName} 삭제`}
                                    title="삭제"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}

                      {adding === kind && (
                        <InlineNameInput
                          initial=""
                          placeholder={`새 ${orgLabels[kind]} 이름`}
                          pending={createMut.isPending}
                          onSubmit={name => createMut.mutate({ kind, name })}
                          onCancel={() => setAdding(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RosterTable({ rows, loading, onSelect }: { rows: RosterRow[]; loading: boolean; onSelect: (memberId: number) => void }) {
  if (loading) {
    return <div className="py-16 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Users className="size-6 text-[var(--color-muted-foreground)]" />
        <p className="text-sm text-[var(--color-muted-foreground)]">해당 조직에 소속된 교인이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)]">
            <th className="px-5 py-2.5 text-left font-medium">이름</th>
            <th className="px-3 py-2.5 text-left font-medium">조직 · 직책</th>
            <th className="px-5 py-2.5 text-left font-medium">재적상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.memberId}
              onClick={() => onSelect(row.memberId)}
              className="cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-muted)]"
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={row.name} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.name}</div>
                    {row.positionName && <div className="text-xs text-[var(--color-muted-foreground)]">{row.positionName}</div>}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {row.affiliations.map((affiliation, index) => (
                    <span key={`${affiliation.unitName}-${index}`} className="inline-flex items-center gap-1 text-xs">
                      <span>{affiliation.unitName}</span>
                      {affiliation.roleLabel ? (
                        <Badge tone="accent">{affiliation.roleLabel}</Badge>
                      ) : (
                        affiliation.isLeader && <Badge tone="accent">리더</Badge>
                      )}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-3">
                <Badge tone="muted">{row.statusName ?? '—'}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 트리 안에서 바로 쓰는 한 줄 입력 — 이름 추가·수정 공용. Enter 저장 / Esc 취소. */
function InlineNameInput({
  initial,
  placeholder,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  pending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const name = value.trim();
    if (!name || name === initial) {
      onCancel();
      return;
    }
    onSubmit(name);
  };

  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        maxLength={40}
        disabled={pending}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => {
          if (isSubmitEnter(event)) commit();
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="min-w-0 flex-1 rounded-md border border-[var(--color-foreground)] bg-[var(--color-background)] px-2 py-1 text-sm outline-none"
      />
      <button
        onClick={commit}
        disabled={pending}
        className="rounded p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        aria-label="저장"
      >
        <Check className="size-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="rounded p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
        aria-label="취소"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
