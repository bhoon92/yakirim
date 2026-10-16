import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 성도 ↔ 테이블 소속 이력 (+테이블 리더). */
@Entity('member_fellowship_table')
@Index(['churchId'])
@Index(['memberId'])
@Index(['tableId'])
@Index(['memberId', 'tableId'], {
  unique: true,
  where: 'end_date IS NULL AND deleted_at IS NULL',
})
export class MemberFellowshipTableEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column({ comment: 'fellowship_table.id' })
  tableId!: number;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ default: false })
  isLeader!: boolean;

  @Column({ comment: '리더 호칭 (테이블 리더 등 free-form)', nullable: true })
  roleLabel?: string;
}
