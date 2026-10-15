import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Phone, Plus, Search, Settings2, Upload, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { createMember, listMembers, type AffiliationKind, type Member, type MemberAffiliationTag, type MemberCounts } from '@/api/members';
import { listResidents } from '@/api/residents';
import { listReferences, type Reference } from '@/api/references';
import { exportMembers } from '@/api/exports';
import { usePermissions } from '@/lib/permissions';
import { ReferenceManagerModal } from '@/components/reference-manager';
import { MemberDetailModal } from '@/routes/app/member-detail-modal';
import { MemberImportModal } from '@/routes/app/member-import-modal';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TagChip } from '@/components/ui/tag-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { useOrgLabels } from '@/lib/org-labels';
import { cn } from '@/lib/utils';

type AffiliationSelection = { kind: AffiliationKind; id: number };

/** 입력이 멈춘 뒤에만 값을 갱신 — 키 입력마다 쿼리 나가는 것 방지. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusId, setStatusId] = useState<number | null>(null);
  const [affiliation, setAffiliation] = useState<AffiliationSelection | null>(null);
  // 담당 간사 필터: null = 전체, 'none' = 담당 없음, 숫자 = 그 간사가 맡은 사람
  const [shepherd, setShepherd] = useState<number | 'none' | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  // 대시보드 "정체된 사람" 카드에서 ?stalled=true 로 넘어온다.
  const [searchParams, setSearchParams] = useSearchParams();
  const stalledOnly = searchParams.get('stalled') === 'true';

  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 300);

  // 조건이 바뀌면 1페이지로 — 3페이지를 보다 검색하면 빈 화면이 뜬다.
  // effect 로 동기화하지 않고 바꾸는 지점에서 함께 되돌린다(연쇄 렌더 방지).
  const changeQuery = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };
  const changeStatus = (value: number | null) => {
    setStatusId(value);
    setPage(1);
  };
  const changeAffiliation = (value: AffiliationSelection | null) => {
    setAffiliation(value);
    setPage(1);
  };
  const changeShepherd = (value: number | 'none' | null) => {
    setShepherd(value);
    setPage(1);
  };
  const clearStalled = () => {
    searchParams.delete('stalled');
    setSearchParams(searchParams, { replace: true });
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['members', { q: debouncedQuery, statusId, affiliation, stalledOnly, shepherd, page }],
    queryFn: () =>
      listMembers({
        q: debouncedQuery || undefined,
        statusId: statusId ?? undefined,
        affiliationKind: affiliation?.kind,
        affiliationId: affiliation?.id,
        stalled: stalledOnly || undefined,
        shepherdResidentId: typeof shepherd === 'number' ? shepherd : undefined,
        noShepherd: shepherd === 'none' || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="교인"
        title="교인 명부"
        description="양성 파이프라인 단계별로 교인을 관리합니다."
        actions={
          <>
            {can('settings:write') && (
              <Button variant="outline" onClick={() => setManaging(true)} aria-label="재적상태·역할" title="재적상태·역할">
                <Settings2 />
                {/* 폰에서는 아이콘만 — 버튼 넷이 두 줄을 차지해 목록이 첫 화면 아래로 밀렸다 */}
                <span className="hidden sm:inline">재적상태·역할</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => void exportMembers()} aria-label="내보내기" title="내보내기">
              <Download />
              <span className="hidden sm:inline">내보내기</span>
            </Button>
            {can('member:write') && (
              <Button variant="outline" onClick={() => setImporting(true)} aria-label="가져오기" title="가져오기">
                <Upload />
                <span className="hidden sm:inline">가져오기</span>
              </Button>
            )}
            {can('member:write') && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus />
                교인 추가
              </Button>
            )}
          </>
        }
      />

      {managing && (
        <ReferenceManagerModal
          title="재적상태·사역 역할·기록 종류 관리"
          kinds={['memberStatus', 'position', 'careNoteType']}
          onClose={() => setManaging(false)}
        />
      )}

      {importing && <MemberImportModal onClose={() => setImporting(false)} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <Input
            placeholder="이름·전화번호로 검색"
            value={searchQuery}
            onChange={event => changeQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <AffiliationFilter value={affiliation} onChange={changeAffiliation} />
          <ShepherdFilter value={shepherd} onChange={changeShepherd} />
        </div>
      </div>

      <FilterChips active={statusId} onChange={changeStatus} counts={data?.counts} />

      {stalledOnly && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f7ecd6] px-3.5 py-2.5">
          <p className="text-xs text-[#8a5700]">
            현재 단계에 기준 일수 이상 머물러 있는 교인만 보고 있습니다. 기준은 재적상태별 설정값입니다.
          </p>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={clearStalled}>
            <X className="size-3.5" />
            해제
          </Button>
        </div>
      )}

      <MemberList
        members={data?.items ?? []}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? 20}
        loading={isLoading}
        onSelect={setOpenMemberId}
        onPageChange={setPage}
      />

      {showCreate && (
        <CreateMemberModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['members'] });
            setShowCreate(false);
          }}
        />
      )}

      {openMemberId !== null && <MemberDetailModal memberId={openMemberId} onClose={() => setOpenMemberId(null)} />}
    </div>
  );
}

/** 담당 간사로 거르기 — "이 간사가 맡은 사람", "아직 담당이 없는 사람"(배정할 사람 찾기). */
function ShepherdFilter({ value, onChange }: { value: number | 'none' | null; onChange: (value: number | 'none' | null) => void }) {
  const { data: residents = [] } = useQuery({ queryKey: ['residents', 'for-shepherd'], queryFn: () => listResidents({ scope: 'active' }) });
  if (residents.length === 0 && value === null) return null;
  return (
    <select
      value={value === null ? '' : String(value)}
      onChange={event => {
        const raw = event.target.value;
        onChange(raw === '' ? null : raw === 'none' ? 'none' : Number(raw));
      }}
      className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)] sm:w-40"
    >
      <option value="">담당 전체</option>
      <option value="none">담당 없음</option>
      <optgroup label="담당 간사">
        {residents.map(resident => (
          <option key={resident.id} value={resident.id}>
            {resident.memberName} ({resident.flockCount})
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function AffiliationFilter({
  value,
  onChange,
}: {
  value: AffiliationSelection | null;
  onChange: (value: AffiliationSelection | null) => void;
}) {
  const year = new Date().getFullYear();
  const departments = useQuery({ queryKey: ['references', 'department', year], queryFn: () => listReferences('department', year) }).data;
  const ministries = useQuery({ queryKey: ['references', 'ministry', year], queryFn: () => listReferences('ministry', year) }).data;
  const smallGroups = useQuery({ queryKey: ['references', 'smallGroup', year], queryFn: () => listReferences('smallGroup', year) }).data;

  const groups: { kind: AffiliationKind; label: string; items: Reference[] }[] = [
    { kind: 'department', label: '부서', items: departments ?? [] },
    { kind: 'ministry', label: '사역팀', items: ministries ?? [] },
    { kind: 'smallGroup', label: '목장', items: smallGroups ?? [] },
  ];

  return (
    <select
      value={value ? `${value.kind}:${value.id}` : ''}
      onChange={event => {
        const raw = event.target.value;
        if (!raw) return onChange(null);
        const [kind, id] = raw.split(':');
        onChange({ kind: kind as AffiliationKind, id: Number(id) });
      }}
      className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)] sm:w-48"
    >
      <option value="">소속 전체</option>
      {groups.map(group =>
        group.items.length > 0 ? (
          <optgroup key={group.kind} label={group.label}>
            {group.items.map(item => (
              <option key={`${group.kind}:${item.id}`} value={`${group.kind}:${item.id}`}>
                {item.name}
              </option>
            ))}
          </optgroup>
        ) : null
      )}
    </select>
  );
}

function FilterChips({
  active,
  onChange,
  counts,
}: {
  active: number | null;
  onChange: (statusId: number | null) => void;
  counts?: MemberCounts;
}) {
  const chips: { key: number | null; label: string; count?: number }[] = [
    { key: null, label: '전체', count: counts?.all },
    ...(counts?.byStatus ?? []).map(status => ({ key: status.id, label: status.name, count: status.count })),
  ];
  // 폰에서는 한 줄 가로 스크롤 — 상태가 열 개라 줄바꿈하면 세 줄을 차지한다
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      {chips.map(chip => {
        const isActive = active === chip.key;
        return (
          <button
            key={chip.key ?? 'all'}
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'border-transparent bg-[var(--color-foreground)] text-[var(--color-background)]'
                : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            )}
          >
            {chip.label}
            {chip.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] tabular-nums',
                  isActive ? 'bg-white/15 text-current' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                )}
              >
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 목록 한 행의 역할·소속 태그 — 상세에서 넣은 것이 여기서도 보이게.
 *
 * 색은 상세 모달과 같은 기준(기준정보 id)이라 같은 조직이면 같은 색이다.
 * 종류를 색으로는 구분할 수 없으니 순서를 고정하고(역할 → 기관 → 사역팀 → 공동체)
 * 어느 종류인지는 hover 로 알려준다. 리더는 테두리로 표시한다.
 */
function MemberTags({ member }: { member: Member }) {
  const orgLabels = useOrgLabels();
  const tags: { key: string; name: string; seed: number; kind: string; leader?: boolean }[] = [];

  if (member.position?.name) {
    tags.push({ key: `p${member.position.id}`, name: member.position.name, seed: member.position.id, kind: '사역 역할' });
  }
  const groups: [MemberAffiliationTag[], string, string][] = [
    [member.departments, orgLabels.department, 'd'],
    [member.ministries, orgLabels.ministry, 'm'],
    [member.smallGroups, orgLabels.smallGroup, 's'],
  ];
  for (const [items, kind, prefix] of groups) {
    for (const item of items) {
      if (!item.name) continue;
      tags.push({ key: `${prefix}${item.id}`, name: item.name, seed: item.id, kind, leader: item.isLeader });
    }
  }

  if (tags.length === 0 && !member.shepherd) return null;

  // 한 행이 태그로 넘치지 않게 자른다 — 자세한 건 상세에서 본다.
  const shown = tags.slice(0, 5);
  const rest = tags.length - shown.length;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {shown.map(tag => (
        <TagChip
          key={tag.key}
          name={tag.name}
          seed={tag.seed}
          title={tag.leader ? `${tag.kind} · 리더` : tag.kind}
          className={cn('px-2 py-0.5', tag.leader && 'ring-1 ring-[var(--color-foreground)] ring-inset')}
          prefix={tag.leader ? <span className="text-[10px] leading-none">★</span> : undefined}
        />
      ))}
      {rest > 0 && <span className="text-[11px] text-[var(--color-muted-foreground)]">+{rest}</span>}
      {/* 담당은 색 태그가 아니라 글자로 — 조직(색)과 다른 종류의 정보라 섞이지 않게 */}
      {member.shepherd && (
        <span className="text-[11px] text-[var(--color-muted-foreground)]" title="담당 간사">
          담당 {member.shepherd.name}
        </span>
      )}
    </div>
  );
}

function MemberList({
  members,
  total,
  page,
  pageSize,
  loading,
  onSelect,
  onPageChange,
}: {
  members: Member[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onSelect: (id: number) => void;
  onPageChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</CardContent>
      </Card>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <UserPlus className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">아직 등록된 교인이 없어요</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">우측 상단 "교인 추가" 버튼으로 시작하세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-[var(--color-border)]">
        {members.map(member => (
          <li key={member.id}>
            <button
              onClick={() => onSelect(member.id)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--color-muted)]"
            >
              <Avatar name={member.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{member.name}</span>
                  <Badge tone="muted">{member.statusName ?? '—'}</Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
                  {member.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" />
                      {member.phone}
                    </span>
                  )}
                  {member.previousChurch && <span>· 이전: {member.previousChurch}</span>}
                </div>
                <MemberTags member={member} />
              </div>
            </button>
          </li>
        ))}
      </ul>
      {/*
       * 페이지 이동 — 서버는 처음부터 페이징해서 주고 있었는데 화면에 컨트롤이 없어서
       * 첫 20명 말고는 볼 방법이 자체가 없었다(교인 9명일 땐 드러나지 않던 문제).
       */}
      <CardContent className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] py-3">
        <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
          {from}–{to} / 총 {total}명
        </span>
        {lastPage > 1 && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="size-3.5" />
              이전
            </Button>
            <span className="px-2 text-xs tabular-nums text-[var(--color-muted-foreground)]">
              {page} / {lastPage}
            </span>
            <Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
              다음
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [statusId, setStatusId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: statuses = [] } = useQuery({
    queryKey: ['references', 'memberStatus'],
    queryFn: () => listReferences('memberStatus'),
  });
  const activeStatuses = statuses.filter(status => status.isActive);

  const mutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => onCreated(),
    onError: (err: Error) => setError(err.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    mutation.mutate({
      name,
      phone: phone || undefined,
      statusId: statusId ?? undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-background)] p-6 shadow-md" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">교인 추가</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="이름" required>
            <Input value={name} onChange={event => setName(event.target.value)} required maxLength={40} placeholder="예: 김민서" />
          </Field>

          <Field label="전화번호" hint="선택">
            <Input value={phone} onChange={event => setPhone(event.target.value)} placeholder="010-1234-5678" />
          </Field>

          <Field label="재적상태">
            <div className="flex flex-wrap gap-1.5">
              {activeStatuses.map(status => (
                <button
                  type="button"
                  key={status.id}
                  onClick={() => setStatusId(status.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    statusId === status.id
                      ? 'border-transparent bg-[var(--color-foreground)] text-[var(--color-background)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                  )}
                >
                  {status.name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              미선택 시 첫 단계로 등록됩니다. 단계 목록은 위의 “재적상태·역할”에서 바꿉니다.
            </p>
          </Field>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={!name || mutation.isPending}>
              {mutation.isPending ? '추가 중…' : '추가하기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-[var(--color-destructive)]">*</span>}
        </span>
        {hint && <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
