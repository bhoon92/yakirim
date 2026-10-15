import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Copy, Plus, RefreshCw, Repeat, Share2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  createCalendar,
  createEvent,
  deleteEvent,
  feedUrl,
  getSubscription,
  listCalendars,
  listEvents,
  RECURRENCE_LABEL,
  regenerateSubscription,
  updateEvent,
  updateSubscription,
  type Calendar,
  type CalendarEvent,
  type Recurrence,
} from '@/api/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { GoogleCalendarPanel } from '@/components/google-calendar-panel';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';
import { useSearchParams } from 'react-router';
import { Plug } from 'lucide-react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 표시 월의 그리드(앞뒤 주 포함) Date 배열. */
function buildMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells: Date[] = [];
  for (let index = 0; index < 42; index++) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    cells.push(day);
  }
  return cells;
}

export function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [addFor, setAddFor] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showSub, setShowSub] = useState(false);
  const [searchParams] = useSearchParams();
  const [showGoogle, setShowGoogle] = useState(searchParams.get('gcal') != null);
  const { can } = usePermissions();
  const canWrite = can('calendar:write');

  const matrix = useMemo(() => buildMatrix(year, month), [year, month]);
  const rangeFrom = matrix[0];
  const rangeTo = new Date(matrix[41]);
  rangeTo.setHours(23, 59, 59);

  const { data: calendars = [] } = useQuery({ queryKey: ['calendars'], queryFn: listCalendars });
  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events', formatDate(rangeFrom), formatDate(rangeTo)],
    queryFn: () => listEvents(rangeFrom.toISOString(), rangeTo.toISOString()),
  });

  const calById = new Map(calendars.map(calendar => [calendar.id, calendar]));
  const visibleEvents = events.filter(event => !hidden.has(event.calendarId));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of visibleEvents) {
    const key = formatDate(new Date(event.startAt));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(event);
  }

  const go = (delta: number) => {
    const day = new Date(year, month + delta, 1);
    setYear(day.getFullYear());
    setMonth(day.getMonth());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="달력"
        title={`${year}년 ${month + 1}월`}
        description="공지·부서·개인 일정을 한 화면에서 확인합니다."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowGoogle(true)}>
              <Plug />
              Google 연동
            </Button>
            <Button variant="outline" onClick={() => setShowSub(true)}>
              <Share2 />
              구독
            </Button>
            {canWrite && (
              <Button onClick={() => setAddFor(formatDate(today))}>
                <Plus />
                일정 추가
              </Button>
            )}
          </>
        }
      />

      {/* 1280px 미만에서는 캘린더 목록을 위로 — 옆에 두면 달력 한 칸이 너무 좁아 일정 제목이 잘렸다 */}
      <div className="grid gap-6 xl:grid-cols-[16rem_1fr]">
        <CalendarSidebar
          calendars={calendars}
          hidden={hidden}
          canWrite={canWrite}
          onToggle={id =>
            setHidden(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" aria-label="이전 달" onClick={() => go(-1)}>
                  <ChevronLeft />
                </Button>
                <div className="px-2 text-sm font-semibold">
                  {year}년 {month + 1}월
                </div>
                <Button variant="ghost" size="icon" aria-label="다음 달" onClick={() => go(1)}>
                  <ChevronRight />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setYear(today.getFullYear());
                  setMonth(today.getMonth());
                }}
              >
                오늘
              </Button>
            </div>

            <div className="grid grid-cols-7 border-t border-l border-[var(--color-border)]">
              {WEEKDAYS.map((day, index) => (
                <div
                  key={day}
                  className={cn(
                    'border-r border-b border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1.5 text-[11px] font-medium',
                    index === 0 && 'text-rose-500',
                    index === 6 && 'text-sky-500'
                  )}
                >
                  {day}
                </div>
              ))}
              {matrix.map((day, index) => {
                const key = formatDate(day);
                const inMonth = day.getMonth() === month;
                const isToday = key === formatDate(today);
                const dayEvents = byDay.get(key) ?? [];
                return (
                  <button
                    key={index}
                    onClick={() => canWrite && setAddFor(key)}
                    className={cn(
                      'min-h-24 border-r border-b border-[var(--color-border)] p-1.5 text-left transition-colors',
                      canWrite && 'hover:bg-[var(--color-muted)]/50',
                      !inMonth && 'bg-[var(--color-muted)]/40'
                    )}
                  >
                    <div
                      className={cn(
                        'mb-1 inline-flex size-6 items-center justify-center text-xs font-medium tabular-nums',
                        isToday && 'rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
                        !inMonth && !isToday && 'text-[var(--color-muted-foreground)]'
                      )}
                    >
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map(event => (
                        <EventPill
                          key={`${event.id}-${event.startAt}`}
                          event={event}
                          color={calById.get(event.calendarId)?.color}
                          canWrite={canWrite}
                          onEdit={setEditingEvent}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="px-1.5 text-[10px] text-[var(--color-muted-foreground)]">+{dayEvents.length - 3}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {addFor && <EventModal date={addFor} calendars={calendars} onClose={() => setAddFor(null)} />}
      {editingEvent && <EventEditModal event={editingEvent} calendars={calendars} onClose={() => setEditingEvent(null)} />}
      {showSub && <SubscriptionModal calendars={calendars} onClose={() => setShowSub(false)} />}
      {showGoogle && (
        <ModalShell title="Google Calendar 연동" onClose={() => setShowGoogle(false)}>
          <GoogleCalendarPanel canWrite={canWrite} />
        </ModalShell>
      )}
    </div>
  );
}

function EventPill({
  event,
  color,
  canWrite,
  onEdit,
}: {
  event: CalendarEvent;
  color?: string;
  canWrite: boolean;
  onEdit: (event: CalendarEvent) => void;
}) {
  const time = event.allDay
    ? null
    : new Date(event.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      onClick={clickEvent => {
        clickEvent.stopPropagation();
        if (canWrite) onEdit(event);
      }}
      title={time ? `${time} ${event.title}` : event.title}
      className="@container flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-opacity hover:opacity-75"
      style={{
        backgroundColor: color ? `color-mix(in oklch, ${color} 14%, transparent)` : 'var(--color-muted)',
        color: color ?? 'inherit',
      }}
    >
      <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {/* 칸이 좁으면 시간이 먼저 자리를 차지해 제목이 통째로 잘렸다 — 넓을 때만 시간을 붙이고 제목을 우선한다 */}
      {time && <span className="hidden shrink-0 tabular-nums opacity-80 @min-[7rem]:inline">{time}</span>}
      <span className="min-w-0 truncate font-medium">{event.title}</span>
      {event.recurrence && <Repeat className="ml-auto size-2.5 shrink-0 opacity-70" />}
    </div>
  );
}

function CalendarSidebar({
  calendars,
  hidden,
  canWrite,
  onToggle,
}: {
  calendars: Calendar[];
  hidden: Set<number>;
  canWrite: boolean;
  onToggle: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const createMut = useMutation({
    mutationFn: () => createCalendar({ name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      setName('');
      setAdding(false);
    },
  });

  return (
    <Card className="h-fit">
      <CardContent className="space-y-1 p-3">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">내 캘린더</span>
          {canWrite && (
            <button
              onClick={() => setAdding(!adding)}
              className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              aria-label={adding ? '달력 추가 취소' : '달력 추가'}
              aria-expanded={adding}
              title={adding ? '취소' : '달력 추가'}
            >
              {adding ? <X className="size-4" /> : <Plus className="size-4" />}
            </button>
          )}
        </div>

        {adding && (
          <form
            onSubmit={event => {
              event.preventDefault();
              if (name.trim()) createMut.mutate();
            }}
            className="px-1 pb-2"
          >
            <Input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="새 달력 이름"
              autoFocus
              maxLength={40}
              className="h-8"
            />
          </form>
        )}

        <ul className="space-y-0.5">
          {calendars.map(calendar => {
            const on = !hidden.has(calendar.id);
            return (
              <li key={calendar.id}>
                <button
                  onClick={() => onToggle(calendar.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-muted)]"
                >
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-[5px] border transition-all',
                      on ? 'border-transparent' : 'border-[var(--color-border)]'
                    )}
                    style={on ? { backgroundColor: calendar.color } : undefined}
                  >
                    {on && <Check className="size-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className={cn('flex-1 truncate', on ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]')}>
                    {calendar.name}
                  </span>
                </button>
              </li>
            );
          })}
          {calendars.length === 0 && !adding && (
            <li className="px-2 py-3 text-xs text-[var(--color-muted-foreground)]">달력이 없습니다. + 로 추가하세요.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function EventModal({ date, calendars, onClose }: { date: string; calendars: Calendar[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState<number | null>(calendars[0]?.id ?? null);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('12:00');
  const [location, setLocation] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);

  const createMut = useMutation({
    mutationFn: () => {
      const startAt = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime}`);
      const endAt = allDay ? undefined : new Date(`${date}T${endTime}`);
      return createEvent({
        calendarId: calendarId!,
        title: title.trim(),
        location: location.trim() || undefined,
        allDay,
        startAt: startAt.toISOString(),
        endAt: endAt?.toISOString(),
        recurrence: recurrence ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      onClose();
    },
    onError: (error: Error) => alert(`일정 추가 실패: ${error.message}`),
  });

  return (
    <ModalShell title={`일정 추가 · ${date}`} onClose={onClose}>
      <div className="space-y-3">
        <Input placeholder="일정 제목" value={title} onChange={event => setTitle(event.target.value)} autoFocus />

        <div className="flex flex-wrap gap-1.5">
          {calendars.map(calendar => (
            <button
              key={calendar.id}
              onClick={() => setCalendarId(calendar.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                calendarId === calendar.id
                  ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: calendar.color }} />
              {calendar.name}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)} />
          종일
        </label>

        {!allDay && (
          <div className="flex items-center gap-2">
            <Input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} className="w-32" />
            <span className="text-[var(--color-muted-foreground)]">~</span>
            <Input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} className="w-32" />
          </div>
        )}

        <Input placeholder="장소 (선택)" value={location} onChange={event => setLocation(event.target.value)} />

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]">
            <Repeat className="size-3.5" />
            반복
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([null, 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'] as const).map(option => (
              <button
                key={option ?? 'none'}
                onClick={() => setRecurrence(option)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  recurrence === option
                    ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                )}
              >
                {option ? RECURRENCE_LABEL[option] : '안 함'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => createMut.mutate()} disabled={!title.trim() || !calendarId || createMut.isPending}>
            추가
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function EventEditModal({ event, calendars, onClose }: { event: CalendarEvent; calendars: Calendar[]; onClose: () => void }) {
  const queryClient = useQueryClient();

  const startDate = new Date(event.startAt);
  const endDate = event.endAt ? new Date(event.endAt) : null;

  const [title, setTitle] = useState(event.title);
  const [calendarId, setCalendarId] = useState(event.calendarId);
  const [allDay, setAllDay] = useState(event.allDay);
  const [date, setDate] = useState(formatDate(startDate));
  const [startTime, setStartTime] = useState(
    event.allDay ? '11:00' : `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
  );
  const [endTime, setEndTime] = useState(
    endDate ? `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}` : '12:00'
  );
  const [location, setLocation] = useState(event.location ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(event.recurrence as Recurrence | null);

  const updateMut = useMutation({
    mutationFn: () => {
      const startAt = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime}`);
      const endAt = allDay ? null : new Date(`${date}T${endTime}`);
      return updateEvent(event.id, {
        calendarId,
        title: title.trim(),
        location: location.trim() || null,
        allDay,
        startAt: startAt.toISOString(),
        endAt: endAt?.toISOString() ?? null,
        recurrence: recurrence ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] });
      onClose();
    },
    onError: (error: Error) => alert(`수정 실패: ${error.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteEvent(event.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] });
      onClose();
    },
    onError: (error: Error) => alert(`삭제 실패: ${error.message}`),
  });

  return (
    <ModalShell title="일정 수정" onClose={onClose}>
      <div className="space-y-3">
        {event.recurrence && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            반복 일정입니다. 저장하면 모든 반복 일정이 수정됩니다.
          </div>
        )}

        <Input placeholder="일정 제목" value={title} onChange={e => setTitle(e.target.value)} autoFocus />

        <div className="flex flex-wrap gap-1.5">
          {calendars.map(calendar => (
            <button
              key={calendar.id}
              onClick={() => setCalendarId(calendar.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                calendarId === calendar.id
                  ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: calendar.color }} />
              {calendar.name}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
          종일
        </label>

        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />

        {!allDay && (
          <div className="flex items-center gap-2">
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-32" />
            <span className="text-[var(--color-muted-foreground)]">~</span>
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-32" />
          </div>
        )}

        <Input placeholder="장소 (선택)" value={location} onChange={e => setLocation(e.target.value)} />

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]">
            <Repeat className="size-3.5" />
            반복
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([null, 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'] as const).map(option => (
              <button
                key={option ?? 'none'}
                onClick={() => setRecurrence(option)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  recurrence === option
                    ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                )}
              >
                {option ? RECURRENCE_LABEL[option] : '안 함'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              const message = event.recurrence ? '전체 반복 일정을 삭제할까요?' : '이 일정을 삭제할까요?';
              if (window.confirm(message)) deleteMut.mutate();
            }}
            disabled={deleteMut.isPending || updateMut.isPending}
          >
            삭제
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button onClick={() => updateMut.mutate()} disabled={!title.trim() || updateMut.isPending || deleteMut.isPending}>
              저장
            </Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function SubscriptionModal({ calendars, onClose }: { calendars: Calendar[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: sub } = useQuery({ queryKey: ['calendar-subscription'], queryFn: getSubscription });

  const updateMut = useMutation({
    mutationFn: (calendarIds: number[]) => updateSubscription(calendarIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-subscription'] }),
  });
  const regenMut = useMutation({
    mutationFn: regenerateSubscription,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-subscription'] }),
  });

  const url = sub ? feedUrl(sub) : '';
  const included = new Set(sub?.calendarIds ?? []);

  const toggle = (id: number) => {
    if (!sub) return;
    const next = new Set(included);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateMut.mutate(Array.from(next));
  };

  return (
    <ModalShell title="iCal 구독" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-muted-foreground)]">
          아래 URL 을 Google/Apple 캘린더에 “URL로 구독” 하면 일정이 자동 동기화됩니다.
        </p>

        <div className="flex gap-2">
          <Input readOnly value={url} className="text-xs" onFocus={event => event.currentTarget.select()} />
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-[var(--color-muted-foreground)]">피드에 포함할 달력</div>
          <ul className="space-y-1">
            {calendars.map(calendar => (
              <li key={calendar.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--color-muted)]">
                  <input
                    type="checkbox"
                    checked={included.has(calendar.id)}
                    onChange={() => toggle(calendar.id)}
                    disabled={updateMut.isPending}
                  />
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: calendar.color }} />
                  {calendar.name}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <span className="text-xs text-[var(--color-muted-foreground)]">URL 유출 시 재발급하세요</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm('기존 구독 URL 이 무효화됩니다. 계속할까요?')) regenMut.mutate();
            }}
            disabled={regenMut.isPending}
          >
            <RefreshCw className="size-3.5" />
            토큰 재발급
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-background)] shadow-md" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기">
            <X />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
