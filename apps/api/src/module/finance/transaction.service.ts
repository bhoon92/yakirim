import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { AccountCategoryEntity } from '@src/database/entities/account-category.entity';
import { FinanceTransactionEntity, TransactionFlow } from '@src/database/entities/finance-transaction.entity';
import { todayString } from '@src/common/date';
import { CreateTransactionDto } from './dto/create-transaction.dto';

export type TransactionItem = {
  id: number;
  flow: TransactionFlow;
  amount: number;
  title: string;
  date: string;
  accountCategoryId: number | null;
  categoryName: string | null;
  budgetAllocationId: number | null;
  note: string | null;
};

@Injectable()
export class TransactionService {
  private repo() {
    return DataSources.instance.getRepository(FinanceTransactionEntity);
  }

  create(churchId: number, recorderAccountId: number, dto: CreateTransactionDto): Promise<FinanceTransactionEntity> {
    const row = this.repo().create({
      churchId,
      flow: dto.flow,
      amount: dto.amount,
      title: dto.title,
      date: dto.date ?? this.today(),
      accountCategoryId: dto.accountCategoryId,
      fiscalYearId: dto.fiscalYearId,
      budgetAllocationId: dto.budgetAllocationId,
      note: dto.note,
      recorderAccountId,
    });
    return this.repo().save(row);
  }

  async list(churchId: number, limit?: number): Promise<TransactionItem[]> {
    const rows = await this.repo().find({
      where: { churchId },
      order: { date: 'DESC', id: 'DESC' },
      ...(limit ? { take: limit } : {}),
    });
    if (rows.length === 0) return [];

    const categoryIds = Array.from(
      new Set(rows.map(transaction => transaction.accountCategoryId).filter((value): value is number => value != null))
    );
    const categories =
      categoryIds.length > 0
        ? await DataSources.instance.getRepository(AccountCategoryEntity).find({ where: categoryIds.map(id => ({ id, churchId })) })
        : [];
    const nameMap = new Map(categories.map(category => [category.id, category.name]));

    return rows.map(transaction => ({
      id: transaction.id,
      flow: transaction.flow,
      amount: transaction.amount,
      title: transaction.title,
      date: transaction.date,
      accountCategoryId: transaction.accountCategoryId ?? null,
      categoryName: transaction.accountCategoryId != null ? (nameMap.get(transaction.accountCategoryId) ?? null) : null,
      budgetAllocationId: transaction.budgetAllocationId ?? null,
      note: transaction.note ?? null,
    }));
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('거래를 찾을 수 없습니다.');
  }

  /** 대시보드용 — flow 별 기간 합계. */
  async sumByFlowBetween(churchId: number, flow: TransactionFlow, start: string, end: string): Promise<number> {
    const raw = (await this.repo()
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'sum')
      .where('t.church_id = :churchId', { churchId })
      .andWhere('t.flow = :flow', { flow })
      .andWhere('t.date BETWEEN :start AND :end', { start, end })
      .getRawOne()) as { sum: string };
    return Number(raw.sum);
  }

  /** budgetAllocationId 별 지출 합계 (집행률 계산용). */
  async expenseByBudget(churchId: number, allocationIds: number[]): Promise<Map<number, number>> {
    if (allocationIds.length === 0) return new Map();
    const rows = (await this.repo()
      .createQueryBuilder('t')
      .select('t.budget_allocation_id', 'allocationId')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'sum')
      .where('t.church_id = :churchId', { churchId })
      .andWhere('t.flow = :flow', { flow: TransactionFlow.EXPENSE })
      .andWhere('t.budget_allocation_id IN (:...ids)', { ids: allocationIds })
      .groupBy('t.budget_allocation_id')
      .getRawMany()) as { allocationId: number; sum: string }[];
    return new Map(rows.map(row => [Number(row.allocationId), Number(row.sum)]));
  }

  private today(): string {
    return todayString();
  }
}
