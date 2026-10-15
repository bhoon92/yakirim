import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, RefreshCw, Unplug } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  disconnectGoogleCalendar,
  fetchGoogleCalendarConnectUrl,
  fetchGoogleCalendarStatus,
  syncGoogleCalendar,
} from '@/api/google-calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Google Calendar 단방향 연동 패널 (달력 페이지의 "Google 연동"에서 사용). */
export function GoogleCalendarPanel({ canWrite }: { canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const callbackResult = params.get('gcal');

  const { data: status, isLoading } = useQuery({
    queryKey: ['google-calendar-status'],
    queryFn: fetchGoogleCalendarStatus,
  });

  const [pushed, setPushed] = useState<number | null>(null);

  const connect = useMutation({
    mutationFn: fetchGoogleCalendarConnectUrl,
    onSuccess: url => {
      window.location.href = url;
    },
  });

  const disconnect = useMutation({
    mutationFn: disconnectGoogleCalendar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] }),
  });

  const sync = useMutation({
    mutationFn: syncGoogleCalendar,
    onSuccess: result => setPushed(result.pushed),
  });

  const connected = status?.connected === true;

  const dismissBanner = () => {
    params.delete('gcal');
    setParams(params, { replace: true });
  };

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div className="flex items-start gap-4">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
              color: 'var(--color-primary)',
            }}
          >
            <CalendarDays className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Google Calendar</h3>
              {connected ? (
                <Badge tone="success">
                  <Check className="size-3" />
                  연결됨
                </Badge>
              ) : (
                <Badge tone="muted">미연결</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              앱에서 만든 일정을 내 구글 캘린더의 전용 캘린더로 자동 전송합니다(단방향).
            </p>
          </div>
        </div>

        {callbackResult === 'connected' && (
          <Banner tone="success" onClose={dismissBanner}>
            Google Calendar 연결이 완료되었습니다.
          </Banner>
        )}
        {callbackResult === 'error' && (
          <Banner tone="danger" onClose={dismissBanner}>
            연결에 실패했습니다. 권한 동의를 모두 허용했는지 확인하고 다시 시도하세요.
          </Banner>
        )}

        {isLoading ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">불러오는 중…</p>
        ) : connected && status.connected ? (
          <div className="space-y-4">
            <dl className="grid gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-[var(--color-muted-foreground)]">계정</dt>
                <dd className="font-medium">{status.googleEmail}</dd>
              </div>
            </dl>

            {pushed !== null && <p className="text-sm text-[var(--color-muted-foreground)]">기존 일정 {pushed}건을 전송했습니다.</p>}

            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                  <RefreshCw className="size-4" />
                  {sync.isPending ? '전송 중…' : '기존 일정 전송'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                  <Unplug className="size-4" />
                  연결 해제
                </Button>
              </div>
            )}
          </div>
        ) : (
          canWrite && (
            <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
              {connect.isPending ? '이동 중…' : 'Google Calendar 연결'}
            </Button>
          )
        )}

        {!canWrite && (
          <p className="text-sm text-[var(--color-muted-foreground)]">연동 설정은 달력 쓰기 권한이 있는 사용자만 가능합니다.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Banner({ tone, children, onClose }: { tone: 'success' | 'danger'; children: React.ReactNode; onClose: () => void }) {
  const cls = tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${cls}`}>
      <span>{children}</span>
      <button onClick={onClose} className="shrink-0 text-xs underline opacity-80 hover:opacity-100">
        닫기
      </button>
    </div>
  );
}
