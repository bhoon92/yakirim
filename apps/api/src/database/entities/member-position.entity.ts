import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 성도 직분 이력 — 활성 1개. */
@Entity('member_position')
@Index(['churchId'])
@Index(['memberId'])
@Index(['positionId'])
@Index(['memberId'], {
  unique: true,
  where: 'end_date IS NULL AND deleted_at IS NULL',
})
export class MemberPositionEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column()
  positionId!: number;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ comment: '비고 (취임 경위 등)', type: 'text', nullable: true })
  note?: string;
}
