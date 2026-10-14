import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Plus, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import {
  ASSIGNABLE_ROLES,
  ROLE_HINT,
  ROLE_LABEL,
  inviteMember,
  linkTeamMember,
  listTeam,
  removeMember,
  updateMemberRole,
  type Role,
  type TeamMember,
} from '@/api/team';
import { listMembers } from '@/api/members';
import { useAuth } from '@/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { usePermissions } from '@/lib/permissions';

export function TeamPage() {
  const { can } = usePermissions();
  const canManage = can('team:manage');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link to="/app/settings" className="inline-flex items-center gap-1 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" />
          설정으로
        </Link>
      </div>

      <PageHeader eyebrow="설정" title="팀원 / 권한" description="이메일로 초대하고 역할을 부여합니다." />

      {canManage ? (
        <TeamManager />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">
            팀원 관리는 소유자·관리자만 가능합니다.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamManager() {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading } = useQuery({ queryKey: ['team'], queryFn: listTeam });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['team'] });

  return (
    <div className="space-y-4">
      <InviteForm onDone={invalidate} />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {members.map(member => (
                <MemberRow key={member.membershipId} member={member} onChanged={invalidate} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  // 초대받는 사람 대부분이 간사다
  const [role, setRole] = useState<Role>('shepherd');
  const [error, setError] = useState<string | null>(null);

  const inviteMut = useMutation({
    mutationFn: () => inviteMember(email.trim(), role),
    onMutate: () => setError(null),
    onSuccess: () => {
      setEmail('');
      onDone();
    },
    onError: (error: Error) => setError(error.message),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <Input
              type="email"
              placeholder="초대할 이메일"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="pl-9"
            />
          </div>
          <RoleSelect value={role} onChange={setRole} />
          <Button onClick={() => inviteMut.mutate()} disabled={!email.trim() || inviteMut.isPending}>
            초대
          </Button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <p className="text-xs text-[var(--color-muted-foreground)]">
          <strong className="font-medium text-[var(--color-foreground)]">{ROLE_LABEL[role]}</strong> — {ROLE_HINT[role]}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">미가입자는 해당 이메일로 Google 로그인 시 자동으로 합류합니다.</p>
      </CardContent>
    </Card>
  );
}

function MemberRow({ member, onChanged }: { member: TeamMember; onChanged: () => void }) {
  const isOwner = member.role === 'owner';

  const roleMut = useMutation({
    mutationFn: (role: Role) => updateMemberRole(member.membershipId, role),
    onSuccess: onChanged,
  });
  const removeMut = useMutation({
    mutationFn: () => removeMember(member.membershipId),
    onSuccess: onChanged,
  });

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{member.name}</span>
          {member.pending && <Badge tone="warn">초대됨</Badge>}
        </div>
        <div className="truncate text-xs text-[var(--color-muted-foreground)]">{member.email}</div>
      </div>

      <MemberLinkCell membershipId={member.membershipId} linked={member.member} onChanged={onChanged} />

      {isOwner ? (
        <Badge tone="neutral">{ROLE_LABEL.owner}</Badge>
      ) : (
        <>
          <RoleSelect value={member.role} onChange={role => roleMut.mutate(role)} disabled={roleMut.isPending} />
          <Button
            size="icon"
            variant="ghost"
            aria-label="제거"
            onClick={() => {
              if (window.confirm(`${member.name} 님을 제거할까요?`)) removeMut.mutate();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </li>
  );
}

/**
 * 계정 ↔ 교인 연결 — 노션 관계형 속성처럼 칸을 눌러 이름으로 찾아 고른다.
 * 간사 계정이면 이 연결로 "내가 맡은 사람" 메뉴가 열린다.
 */
function MemberLinkCell({
  membershipId,
  linked,
  onChanged,
}: {
  membershipId: number;
  linked: { id: number; name: string } | null;
  onChanged: () => void;
}) {
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const { data } = useQuery({
    queryKey: ['members', 'for-team-link', query],
    queryFn: () => listMembers({ q: query || undefined, pageSize: 8 }),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const linkMut = useMutation({
    mutationFn: (memberId: number | null) => linkTeamMember(membershipId, memberId),
    onSuccess: () => {
      setOpen(false);
      setQuery('');
      onChanged();
      // 내 계정을 연결했으면 사이드바의 "내가 맡은 사람"이 바로 생겨야 한다
      void refresh();
    },
    onError: (error: Error) => window.alert(`연결 실패: ${error.message}`),
  });

  return (
    <div ref={rootRef} className="relative">
      {linked ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-muted)] py-1 pr-1 pl-2 text-xs font-medium">
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1" title="다른 교인으로 바꾸기">
            <UserRound className="size-3.5 text-[var(--color-muted-foreground)]" />
            {linked.name}
          </button>
          <button
            onClick={() => linkMut.mutate(null)}
            disabled={linkMut.isPending}
            className="rounded p-0.5 text-[var(--color-muted-foreground)] hover:bg-black/5"
            aria-label="연결 해제"
          >
            <X className="size-3" />
          </button>
        </span>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <Plus className="size-3.5" />
          교인 연결
        </button>
      )}

      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1.5 shadow-md">
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => event.key === 'Escape' && setOpen(false)}
            placeholder="교인 이름 검색"
            className="w-full rounded-md bg-[var(--color-muted)] px-2.5 py-1.5 text-sm outline-none"
          />
          <ul className="mt-1 max-h-60 overflow-y-auto">
            {(data?.items ?? []).map(candidate => (
              <li key={candidate.id}>
                <button
                  onClick={() => linkMut.mutate(candidate.id)}
                  disabled={linkMut.isPending || candidate.id === linked?.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
                >
                  <UserRound className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                  <span className="truncate">{candidate.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-[var(--color-muted-foreground)]">{candidate.statusName}</span>
                </button>
              </li>
            ))}
            {data && data.items.length === 0 && (
              <li className="px-2 py-2 text-xs text-[var(--color-muted-foreground)]">검색 결과가 없습니다.</li>
            )}
          </ul>
          <p className="border-t border-[var(--color-border)] px-2 pt-1.5 pb-0.5 text-[11px] text-[var(--color-muted-foreground)]">
            간사로 연결하면 “내가 맡은 사람” 메뉴가 열립니다.
          </p>
        </div>
      )}
    </div>
  );
}

function RoleSelect({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value as Role)}
      disabled={disabled}
      className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm outline-none focus:border-[var(--color-foreground)] disabled:opacity-50"
    >
      {ASSIGNABLE_ROLES.map(role => (
        <option key={role} value={role} title={ROLE_HINT[role]}>
          {ROLE_LABEL[role]}
        </option>
      ))}
    </select>
  );
}
