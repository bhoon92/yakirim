import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 성도 ↔ 목장 소속 이력 (+리더). */
@Entity('member_small_group')
@Index(['churchId'])
@Index(['memberId'])
@Index(['smallGroupId'])
@Index(['memberId', 'smallGroupId'], {
  unique: true,
  where: 'end_date IS NULL AND deleted_at IS NULL',
})
export class MemberSmallGroupEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column()
  smallGroupId!: number;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ default: false })
  isLeader!: boolean;

  @Column({ comment: '리더 호칭 (목자/구역장 등 free-form)', nullable: true })
  roleLabel?: string;
}
