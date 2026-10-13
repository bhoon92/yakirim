import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 간사 × 맡은 사역. 떼면 soft delete 라 created_at ~ deleted_at 이 그대로 "언제부터 언제까지 맡았나"가 된다.
 * 같은 사역을 다시 붙이면 새 행이 생긴다 (부분 유니크 인덱스).
 */
@Entity('resident_duty_assignment')
@Index(['churchId'])
@Index(['dutyId'])
@Index(['residentId', 'dutyId'], { unique: true, where: 'deleted_at IS NULL' })
export class ResidentDutyAssignmentEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  residentId!: number;

  @Column()
  dutyId!: number;
}
