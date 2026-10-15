import { Injectable } from '@nestjs/common';
import { TransactionFlow } from '@src/database/entities/finance-transaction.entity';
import { BudgetService } from './budget.service';
import { FiscalYearService } from './fiscal-year.service';
import { OfferingService } from './offering.service';
import { TransactionService } from './transaction.service';

export type FinanceDashboard = {
  month: string;
  thisMonthOffering: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  fiscalYear: { id: number; name: string } | null;
  budget: { allocated: number; used: number; rate: number } | null;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly offerings: OfferingService,
    private readonly transactions: TransactionService,
    private readonly budgets: BudgetService,
    private readonly fiscalYears: FiscalYearService
  ) {}

  /** 실시간 재정 대시보드 (planning 4.2 ⭐ 페인 포인트). */
  async summary(churchId: number): Promise<FinanceDashboard> {
    const { start, end, label } = this.currentMonthRange();

    const [thisMonthOffering, thisMonthIncome, thisMonthExpense, fy] = await Promise.all([
      this.offerings.sumBetween(churchId, start, end),
      this.transactions.sumByFlowBetween(churchId, TransactionFlow.INCOME, start, end),
      this.transactions.sumByFlowBetween(churchId, TransactionFlow.EXPENSE, start, end),
      this.fiscalYears.current(churchId),
    ]);

    const budget = fy ? await this.budgets.executionRate(churchId, fy.id) : null;

    return {
      month: label,
      thisMonthOffering,
      thisMonthIncome,
      thisMonthExpense,
      fiscalYear: fy ? { id: fy.id, name: fy.name } : null,
      budget,
    };
  }

  private currentMonthRange(): { start: string; end: string; label: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
    return { start, end, label: `${y}-${String(m + 1).padStart(2, '0')}` };
  }
}
