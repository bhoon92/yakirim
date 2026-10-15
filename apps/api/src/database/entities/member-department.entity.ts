import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 성도 ↔ 부서 소속 이력 (+리더). */
@Entity('member_department')
@Index(['churchId'])
@Index(['memberId'])
@Index(['departmentId'])
@Index(['memberId', 'departmentId'], { unique: true, where: 'end_date IS NULL AND deleted_at IS NULL' })
export class MemberDepartmentEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column()
  departmentId!: number;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ default: false })
  isLeader!: boolean;

  @Column({ comment: '리더 호칭 (부서장/부감/총무 등 free-form)', nullable: true })
  roleLabel?: string;
}
