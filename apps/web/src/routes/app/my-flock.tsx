import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartHandshake, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { fetchMyFlock, type FlockMember } from '@/api/shepherds';
import { useAuth } from '@/auth/auth-context';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MemberDetailModal } from './member-detail-modal';

/** 이 날수 넘게 양육기록이 없으면 "연락할 때가 된 사람"으로 올린다. 간사 상세의 강조 기준과 같다. */
const QUIET_DAYS = 30;

/**
 * 내가 맡은 사람 — 간사가 로그인해서 가장 먼저 보는 자기 화면.
 * 계정 ↔ 교인 연결(설정 › 팀원)과 그 교인의 간사 등록이 있어야 열린다.
 * 사람을 누르면 교인 카드가 열리고, 거기서 양육기록을 남기면 이 목록의 순서가 바로 바뀐다.
 */
export function MyFlockPage() {
  const queryClient = useQueryClient();
  const { state } = useAuth();
  const self = state.status === 'authenticated' ? state.self : null;
  const [openMemberId, setOpenMemberId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['flock', 'me'], queryFn: fetchMyFlock });
  const flock = data?.flock ?? [];
  // 기록이 한 번도 없는 사람도 "연락할 때"다 — 막 맡았어도 첫 만남이 아직이니까
  const needsContact = (row: FlockMember) => !row.lastCareNoteDate || row.daysSinceContact >= QUIET_DAYS;
  const quiet = flock.filter(needsContact);
  const recent = flock.filter(row => !needsContact(row));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={self ? `${self.memberName} 간사` : '내 공간'}
        title="내가 맡은 사람"
        description="양육기록을 남긴 지 오래된 사람이 위에 있습니다. 이름을 누르면 교인 카드에서 바로 기록할 수 있습니다."
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
      ) : !data?.residentId ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <HeartHandshake className="mx-auto size-8 text-[var(--color-muted-foreground)]" />
            <p className="text-sm font-medium">이 계정은 아직 간사와 연결되어 있지 않습니다</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              <Link to="/app/settings/team" className="underline underline-offset-2">
                설정 › 팀원
              </Link>
              에서 계정에 교인을 연결하고, 그 교인을{' '}
              <Link to="/app/residents" className="underline underline-offset-2">
                간사
              </Link>
              로 등록하면 열립니다.
            </p>
          </CardContent>
        </Card>
      ) : flock.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">
            아직 맡은 성도가 없습니다. 간사 화면이나 교인 카드에서 담당을 정하면 여기 나타납니다.
          </CardContent>
        </Card>
      ) : (
        <>
          {quiet.length > 0 && (
            <FlockGroup
              title="연락할 때가 된 사람"
              hint={`기록이 없거나 ${QUIET_DAYS}일 넘음`}
              rows={quiet}
              highlight
              onOpen={setOpenMemberId}
            />
          )}
          {recent.length > 0 && <FlockGroup title="최근에 만난 사람" rows={recent} onOpen={setOpenMemberId} />}
        </>
      )}

      {openMemberId !== null && (
        <MemberDetailModal
          memberId={openMemberId}
          onClose={() => {
            setOpenMemberId(null);
            // 카드에서 남긴 기록이 순서에 바로 반영되게
            queryClient.invalidateQueries({ queryKey: ['flock'] });
          }}
        />
      )}
    </div>
  );
}

function FlockGroup({
  title,
  hint,
  rows,
  highlight,
  onOpen,
}: {
  title: string;
  hint?: string;
  rows: FlockMember[];
  highlight?: boolean;
  onOpen: (memberId: number) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-[var(--color-muted-foreground)] tabular-nums">{rows.length}명</span>
        {hint && <span className="text-xs text-[var(--color-muted-foreground)]">· {hint}</span>}
      </div>
      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map(row => (
            <li key={row.memberId} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => onOpen(row.memberId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar name={row.memberName} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.memberName}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">{row.statusName}</div>
                </div>
              </button>
              {/* 폰에서 바로 전화 — 간사는 현장에서 쓴다 */}
              {row.phone && (
                <a
                  href={`tel:${row.phone}`}
                  className="rounded-full p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                  aria-label={`${row.memberName}에게 전화`}
                >
                  <Phone className="size-4" />
                </a>
              )}
              <div className="shrink-0 text-right whitespace-nowrap">
                <div className={cn('text-sm tabular-nums', highlight ? 'font-semibold text-[#8a5700]' : 'font-medium')}>
                  {row.lastCareNoteDate ? `${row.daysSinceContact}일 전` : '기록 없음'}
                </div>
                <div className="text-[11px] text-[var(--color-muted-foreground)] tabular-nums">
                  {row.lastCareNoteDate ? `마지막 ${row.lastCareNoteDate}` : `${row.since}부터 담당`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
