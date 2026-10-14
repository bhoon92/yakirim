import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchDashboard, formatKRW } from '@/api/finance';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { OfferingsView } from './finance/offerings-view';
import { OperationsView } from './finance/operations-view';
import { BudgetView } from './finance/budget-view';

const TABS = ['헌금', '운영 재정', '부서별 예산'] as const;
type Tab = (typeof TABS)[number];

export function FinancePage() {
  const [tab, setTab] = useState<Tab>('헌금');

  const { data: dashboard } = useQuery({
    queryKey: ['finance', 'dashboard'],
    queryFn: fetchDashboard,
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="재정" title="재정 관리" description="개인 헌금과 운영 예산을 한 곳에서 관리합니다." />

      <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
        <SummaryCard label="이번 달 헌금" value={formatKRW(dashboard?.thisMonthOffering ?? 0)} hint={dashboard?.month} />
        <SummaryCard label="이번 달 지출" value={formatKRW(dashboard?.thisMonthExpense ?? 0)} hint={dashboard?.month} />
        <SummaryCard
          label="예산 집행률"
          value={dashboard?.budget ? `${dashboard.budget.rate}%` : '—'}
          hint={dashboard?.fiscalYear?.name ?? '회계연도 미설정'}
        />
      </div>

      <div className="border-b border-[var(--color-border)]">
        <div className="flex gap-4">
          {TABS.map(tabOption => (
            <button
              key={tabOption}
              onClick={() => setTab(tabOption)}
              className={cn(
                'relative -mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors',
                tab === tabOption
                  ? 'border-[var(--color-foreground)] text-[var(--color-foreground)]'
                  : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
              )}
            >
              {tabOption}
            </button>
          ))}
        </div>
      </div>

      {tab === '헌금' && <OfferingsView />}
      {tab === '운영 재정' && <OperationsView />}
      {tab === '부서별 예산' && <BudgetView />}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      {/* 폰에서는 한 줄(이름 왼쪽 · 금액 오른쪽) — 금액이 길어 세 칸 나란히는 안 들어가고, 큰 카드 셋을 쌓으면 화면 하나가 다 찬다 */}
      <CardContent className="flex items-baseline justify-between gap-3 p-3.5 sm:block sm:p-5">
        <div className="min-w-0">
          <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
          {hint && <div className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)] sm:hidden">{hint}</div>}
        </div>
        <div className="shrink-0 text-lg font-semibold tabular-nums sm:mt-1.5 sm:text-2xl">{value}</div>
        {hint && <div className="mt-2 hidden text-xs text-[var(--color-muted-foreground)] sm:block">{hint}</div>}
      </CardContent>
    </Card>
  );
}
