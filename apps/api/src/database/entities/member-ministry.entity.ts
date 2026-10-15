import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 성도 ↔ 사역팀 소속 이력 (+리더). */
@Entity('member_ministry')
@Index(['churchId'])
@Index(['memberId'])
@Index(['ministryId'])
@Index(['memberId', 'ministryId'], {
  unique: true,
  where: 'end_date IS NULL AND deleted_at IS NULL',
})
export class MemberMinistryEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column()
  ministryId!: number;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ default: false })
  isLeader!: boolean;

  @Column({ comment: '리더 호칭 (팀장/부팀장 등 free-form)', nullable: true })
  roleLabel?: string;
}
