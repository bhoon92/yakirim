import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ObjectLiteral } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { BudgetAllocationEntity, BudgetTargetKind } from '@src/database/entities/budget-allocation.entity';
import { DepartmentEntity } from '@src/database/entities/department.entity';
import { FiscalYearEntity } from '@src/database/entities/fiscal-year.entity';
import { MinistryEntity } from '@src/database/entities/ministry.entity';
import { SmallGroupEntity } from '@src/database/entities/small-group.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { TransactionService } from './transaction.service';

const TARGET_ENTITY: Record<BudgetTargetKind, { new (): ObjectLiteral }> = {
  [BudgetTargetKind.DEPARTMENT]: DepartmentEntity,
  [BudgetTargetKind.MINISTRY]: MinistryEntity,
  [BudgetTargetKind.SMALL_GROUP]: SmallGroupEntity,
};

export type BudgetItem = {
  id: number;
  fiscalYearId: number;
  targetKind: BudgetTargetKind;
  targetId: number;
  targetName: string | null;
  allocated: number;
  used: number;
  remaining: number;
  rate: number;
  note: string | null;
};

@Injectable()
export class BudgetService {
  constructor(private readonly transactions: TransactionService) {}

  private repo() {
    return DataSources.instance.getRepository(BudgetAllocationEntity);
  }

  async list(churchId: number, fiscalYearId?: number): Promise<BudgetItem[]> {
    const where = fiscalYearId ? { churchId, fiscalYearId } : { churchId };
    const rows = await this.repo().find({ where, order: { id: 'ASC' } });
    if (rows.length === 0) return [];

    const usedMap = await this.transactions.expenseByBudget(
      churchId,
      rows.map(allocation => allocation.id)
    );
    const nameMaps = await this.targetNameMaps(churchId);

    return rows.map(allocation => {
      const used = usedMap.get(allocation.id) ?? 0;
      const allocated = allocation.amount;
      return {
        id: allocation.id,
        fiscalYearId: allocation.fiscalYearId,
        targetKind: allocation.targetKind,
        targetId: allocation.targetId,
        targetName: nameMaps[allocation.targetKind].get(allocation.targetId) ?? null,
        allocated,
        used,
        remaining: allocated - used,
        rate: allocated === 0 ? 0 : Math.round((used / allocated) * 100),
        note: allocation.note ?? null,
      };
    });
  }

  async create(churchId: number, dto: CreateBudgetDto): Promise<BudgetAllocationEntity> {
    await this.assertFiscalYear(churchId, dto.fiscalYearId);
    await this.assertTarget(churchId, dto.targetKind, dto.targetId);
    const row = this.repo().create({
      churchId,
      fiscalYearId: dto.fiscalYearId,
      targetKind: dto.targetKind,
      targetId: dto.targetId,
      amount: dto.amount,
      note: dto.note,
    });
    return this.repo().save(row);
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('예산 할당을 찾을 수 없습니다.');
  }

  /** 대시보드용 — 회계연도 전체 집행률. */
  async executionRate(churchId: number, fiscalYearId: number): Promise<{ allocated: number; used: number; rate: number }> {
    const items = await this.list(churchId, fiscalYearId);
    const allocated = items.reduce((sum, item) => sum + item.allocated, 0);
    const used = items.reduce((sum, item) => sum + item.used, 0);
    return { allocated, used, rate: allocated === 0 ? 0 : Math.round((used / allocated) * 100) };
  }

  private async targetNameMaps(churchId: number): Promise<Record<BudgetTargetKind, Map<number, string>>> {
    const [departments, ministries, smallGroups] = await Promise.all([
      DataSources.instance.getRepository(DepartmentEntity).find({ where: { churchId } }),
      DataSources.instance.getRepository(MinistryEntity).find({ where: { churchId } }),
      DataSources.instance.getRepository(SmallGroupEntity).find({ where: { churchId } }),
    ]);
    return {
      [BudgetTargetKind.DEPARTMENT]: new Map(departments.map(department => [department.id, department.name])),
      [BudgetTargetKind.MINISTRY]: new Map(ministries.map(ministry => [ministry.id, ministry.name])),
      [BudgetTargetKind.SMALL_GROUP]: new Map(smallGroups.map(smallGroup => [smallGroup.id, smallGroup.name])),
    };
  }

  private async assertFiscalYear(churchId: number, fiscalYearId: number): Promise<void> {
    const fy = await DataSources.instance.getRepository(FiscalYearEntity).findOne({ where: { id: fiscalYearId, churchId } });
    if (!fy) throw new BadRequestException('회계연도를 찾을 수 없습니다.');
  }

  private async assertTarget(churchId: number, kind: BudgetTargetKind, targetId: number): Promise<void> {
    const entity = TARGET_ENTITY[kind];
    const found = await DataSources.instance.getRepository(entity).findOne({ where: { id: targetId, churchId } as never });
    if (!found) throw new BadRequestException('할당 대상을 찾을 수 없습니다.');
  }
}
