import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  BUDGET_KIND_LABEL,
  createBudget,
  createFiscalYear,
  deleteBudget,
  formatKRW,
  listBudgets,
  listFiscalYears,
  setCurrentFiscalYear,
  type BudgetTargetKind,
  type FiscalYear,
} from '@/api/finance';
import { exportBudgets } from '@/api/exports';
import { listReferences, type ReferenceKind } from '@/api/references';
import { usePermissions } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { orgKindFromBudgetKind, useOrgLabels } from '@/lib/org-labels';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isSubmitEnter } from '@/lib/keyboard';

const KIND_TO_REF: Record<BudgetTargetKind, ReferenceKind> = {
  department: 'department',
  ministry: 'ministry',
  small_group: 'smallGroup',
};

export function BudgetView() {
  const { can } = usePermissions();
  const canWrite = can('finance:write');
  const { data: fiscalYears = [], isLoading } = useQuery({
    queryKey: ['finance', 'fiscal-years'],
    queryFn: listFiscalYears,
  });

  const current = fiscalYears.find(fy => fy.isCurrent) ?? fiscalYears[0] ?? null;

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>;
  }

  if (fiscalYears.length === 0 || !current) {
    return canWrite ? (
      <FiscalYearSetup />
    ) : (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          설정된 회계연도가 없습니다. 재정 담당자에게 문의하세요.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <FiscalYearBar fiscalYears={fiscalYears} current={current} canWrite={canWrite} />
      {canWrite && <AllocationForm fiscalYearId={current.id} />}
      <BudgetCards fiscalYearId={current.id} canWrite={canWrite} />
    </div>
  );
}

function FiscalYearSetup() {
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const [name, setName] = useState(`${year} 회계연도`);
  const [startDate, setStartDate] = useState(`${year}-01-01`);
  const [endDate, setEndDate] = useState(`${year}-12-31`);

  const createMut = useMutation({
    mutationFn: createFiscalYear,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'fiscal-years'] }),
    onError: (error: Error) => alert(`회계연도 생성 실패: ${error.message}`),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold">회계연도 설정</h3>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">예산은 회계연도 단위로 관리됩니다. 먼저 회계연도를 만드세요.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input value={name} onChange={event => setName(event.target.value)} placeholder="이름" />
          <Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
        </div>
        <Button
          onClick={() => createMut.mutate({ name, startDate, endDate, isCurrent: true })}
          disabled={!name.trim() || createMut.isPending}
        >
          회계연도 만들기
        </Button>
      </CardContent>
    </Card>
  );
}

function FiscalYearBar({ fiscalYears, current, canWrite }: { fiscalYears: FiscalYear[]; current: FiscalYear; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const setCurrentMut = useMutation({
    mutationFn: setCurrentFiscalYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'fiscal-years'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
    },
    onError: (error: Error) => alert(`회계연도 변경 실패: ${error.message}`),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">회계연도</span>
      {fiscalYears.map(fy => (
        <button
          key={fy.id}
          onClick={() => canWrite && fy.id !== current.id && setCurrentMut.mutate(fy.id)}
          disabled={!canWrite}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            fy.id === current.id
              ? 'bg-[var(--color-foreground)] text-[var(--color-background)]'
              : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
          )}
        >
          {fy.name}
        </button>
      ))}
      <Button size="sm" variant="outline" className="ml-auto" onClick={() => void exportBudgets(current.id)}>
        <Download className="size-3.5" />
        엑셀
      </Button>
    </div>
  );
}

function AllocationForm({ fiscalYearId }: { fiscalYearId: number }) {
  const orgLabels = useOrgLabels();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<BudgetTargetKind>('department');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const currentYear = new Date().getFullYear();

  const { data: targets = [] } = useQuery({
    queryKey: ['references', KIND_TO_REF[kind], currentYear],
    queryFn: () => listReferences(KIND_TO_REF[kind], currentYear),
  });

  const createMut = useMutation({
    mutationFn: createBudget,
    onSuccess: () => {
      setTargetId(null);
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
    },
    onError: (error: Error) => alert(`예산 할당 실패: ${error.message}`),
  });

  const submit = () => {
    const value = Number(amount.replace(/[^0-9]/g, ''));
    if (!targetId || !value) return;
    createMut.mutate({ fiscalYearId, targetKind: kind, targetId, amount: value });
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="inline-flex rounded-full border border-[var(--color-border)] p-0.5">
          {(Object.keys(BUDGET_KIND_LABEL) as BudgetTargetKind[]).map(kindOption => (
            <button
              key={kindOption}
              onClick={() => {
                setKind(kindOption);
                setTargetId(null);
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                kind === kindOption ? 'bg-[var(--color-foreground)] text-[var(--color-background)]' : 'text-[var(--color-muted-foreground)]'
              )}
            >
              {orgLabels[orgKindFromBudgetKind(kindOption)]}
            </button>
          ))}
        </div>

        {targets.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            등록된 {orgLabels[orgKindFromBudgetKind(kind)]}이 없습니다. 설정에서 먼저 등록하세요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {targets.map(target => (
              <button
                key={target.id}
                onClick={() => setTargetId(target.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  targetId === target.id
                    ? 'border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                )}
              >
                {target.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder="할당 금액"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            onKeyDown={event => {
              if (isSubmitEnter(event)) submit();
            }}
            className="max-w-xs text-right tabular-nums"
          />
          <Button onClick={submit} disabled={!targetId || !amount || createMut.isPending}>
            예산 할당
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetCards({ fiscalYearId, canWrite }: { fiscalYearId: number; canWrite: boolean }) {
  const orgLabels = useOrgLabels();
  const queryClient = useQueryClient();
  const { data: budgets = [] } = useQuery({
    queryKey: ['finance', 'budgets', fiscalYearId],
    queryFn: () => listBudgets(fiscalYearId),
  });

  const deleteMut = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
    },
    onError: (error: Error) => alert(`삭제 실패: ${error.message}`),
  });

  if (budgets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">할당된 예산이 없습니다.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {budgets.map(budget => {
        const tone = budget.rate >= 90 ? 'danger' : budget.rate >= 70 ? 'warn' : ('success' as const);
        return (
          <Card key={budget.id}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{budget.targetName ?? '(이름 없음)'}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">{orgLabels[orgKindFromBudgetKind(budget.targetKind)]}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={tone}>{budget.rate}%</Badge>
                  {canWrite && (
                    <button
                      onClick={() => {
                        if (window.confirm('이 예산 할당을 삭제할까요?')) deleteMut.mutate(budget.id);
                      }}
                      className="rounded-full p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                      aria-label="삭제"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-muted-foreground)]">사용</span>
                  <span className="font-medium tabular-nums">
                    {formatKRW(budget.used)} / {formatKRW(budget.allocated)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(budget.rate, 100)}%`,
                      backgroundColor: 'var(--color-primary)',
                    }}
                  />
                </div>
                <div className="text-xs text-[var(--color-muted-foreground)]">잔여 {formatKRW(budget.remaining)}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
