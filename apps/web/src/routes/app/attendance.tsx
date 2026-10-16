import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Printer, Settings2 } from 'lucide-react';
import { useState } from 'react';

import { fetchRoster, markAttendance, type RosterItem } from '@/api/attendance';
import { exportAttendanceSheet } from '@/api/exports';
import { listReferences, type Reference } from '@/api/references';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { ReferenceManagerModal } from '@/components/reference-manager';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';
import { todayString, toDateString } from '@/lib/date';

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export function AttendancePage() {
  const today = todayString();
  const [date, setDate] = useState(today);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  const { can } = usePermissions();

  const { data: services = [] } = useQuery({
    queryKey: ['references', 'worshipService'],
    queryFn: () => listReferences('worshipService'),
  });

  // 예배 목록 로드되면 첫 예배 자동 선택
  const activeServiceId = serviceId ?? services[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="출석"
        title="출석 체크"
        description="예배별 출석을 기록하고 출석률을 확인합니다."
        actions={
          <>
            {/* 종이로 출석을 보시는 분께 — 고른 날짜의 달 · 고른 예배로 주일 칸이 있는 양식을 내려준다 */}
            {services.length > 0 && (
              <Button
                variant="outline"
                onClick={() => void exportAttendanceSheet(date.slice(0, 7), activeServiceId ?? undefined)}
                aria-label="출석부 출력"
                title={`${Number(date.slice(5, 7))}월 출석부 엑셀 (인쇄용)`}
              >
                <Printer />
                <span className="hidden sm:inline">출석부 출력</span>
              </Button>
            )}
            {can('settings:write') && (
              <Button variant="outline" onClick={() => setManaging(true)}>
                <Settings2 />
                예배 관리
              </Button>
            )}
          </>
        }
      />

      {managing && <ReferenceManagerModal title="예배 관리" kinds={['worshipService']} onClose={() => setManaging(false)} />}

      {services.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">등록된 예배가 없습니다. 먼저 예배를 등록하세요.</p>
            {can('settings:write') && (
              <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
                예배 등록
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <AttendanceBoard
          services={services}
          serviceId={activeServiceId}
          onSelectService={setServiceId}
          date={date}
          onDateChange={setDate}
        />
      )}
    </div>
  );
}

function AttendanceBoard({
  services,
  serviceId,
  onSelectService,
  date,
  onDateChange,
}: {
  services: Reference[];
  serviceId: number | null;
  onSelectService: (id: number) => void;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const { data: roster, isLoading } = useQuery({
    queryKey: ['attendance', serviceId, date],
    queryFn: () => fetchRoster(serviceId!, date),
    enabled: serviceId != null,
  });

  return (
    <>
      {/* 폰에서도 한 줄 — 세로로 쌓으면 출석 체크 목록이 두 번째 화면으로 밀린다 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard label="출석" value={`${roster?.present ?? 0}`} suffix={`/ ${roster?.total ?? 0}`} />
        <StatCard label="출석률" value={`${roster?.rate ?? 0}%`} />
        <StatCard label="결석" value={`${(roster?.total ?? 0) - (roster?.present ?? 0)}`} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DateNav date={date} onChange={onDateChange} />
            <div className="flex flex-wrap gap-1.5">
              {services.map(service => (
                <button
                  key={service.id}
                  onClick={() => onSelectService(service.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    serviceId === service.id
                      ? 'bg-[var(--color-foreground)] text-[var(--color-background)]'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                  )}
                >
                  {service.name}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>
          ) : !roster || roster.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">대상 교인이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {roster.items.map(item => (
                <AttendanceRow key={item.memberId} item={item} worshipServiceId={roster.worshipServiceId} date={date} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function AttendanceRow({ item, worshipServiceId, date }: { item: RosterItem; worshipServiceId: number; date: string }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('attendance:write');

  const mut = useMutation({
    mutationFn: (present: boolean) => markAttendance({ worshipServiceId, memberId: item.memberId, date, present }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', worshipServiceId, date] }),
  });

  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        onClick={() => canWrite && mut.mutate(!item.present)}
        disabled={mut.isPending || !canWrite}
        aria-label={item.present ? '출석 취소' : '출석'}
        className={cn(
          'flex size-6 items-center justify-center rounded-md border transition-colors disabled:opacity-50',
          item.present
            ? 'border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
            : 'border-[var(--color-border)] bg-[var(--color-background)]',
          canWrite && !item.present && 'hover:border-[var(--color-foreground)]'
        )}
      >
        {item.present && <Check className="size-4" strokeWidth={3} />}
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium">{item.name}</div>
      </div>
      {item.statusName && <Badge tone="muted">{item.statusName}</Badge>}
      {item.present && <Badge tone="success">출석</Badge>}
    </li>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-5">
        <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
        <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">
          {value}
          {suffix && <span className="ml-1 text-sm font-normal text-[var(--color-muted-foreground)]">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function DateNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="icon" aria-label="이전 날" onClick={() => onChange(shiftDate(date, -1))}>
        <ChevronLeft />
      </Button>
      <label className="relative rounded-xl bg-[var(--color-muted)] px-3 py-1.5 text-sm font-medium">
        {formatDate(date)}
        <Input
          type="date"
          value={date}
          onChange={event => onChange(event.target.value)}
          className="absolute inset-0 h-full cursor-pointer opacity-0"
          aria-label="날짜 선택"
        />
      </label>
      <Button variant="ghost" size="icon" aria-label="다음 날" onClick={() => onChange(shiftDate(date, 1))}>
        <ChevronRight />
      </Button>
    </div>
  );
}
