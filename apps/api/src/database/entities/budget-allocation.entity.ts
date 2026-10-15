import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../column-transformer';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

export enum BudgetTargetKind {
  DEPARTMENT = 'department',
  MINISTRY = 'ministry',
  SMALL_GROUP = 'small_group',
}

/** 부서·사역팀·목장 단위 예산 할당. */
@Entity('budget_allocation')
@Index(['churchId'])
@Index(['churchId', 'fiscalYearId'])
@Index(['fiscalYearId', 'targetKind', 'targetId'], { unique: true, where: 'deleted_at IS NULL' })
export class BudgetAllocationEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  fiscalYearId!: number;

  @Column({ type: 'enum', enum: BudgetTargetKind })
  targetKind!: BudgetTargetKind;

  @Column()
  targetId!: number;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
