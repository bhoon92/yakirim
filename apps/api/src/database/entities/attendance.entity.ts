import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 출석 기록 — 예배별 성도 출석. */
@Entity('attendance')
@Index(['churchId'])
@Index(['churchId', 'worshipServiceId', 'date'])
@Index(['memberId'])
@Index(['worshipServiceId', 'memberId', 'date'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class AttendanceEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  worshipServiceId!: number;

  @Column()
  memberId!: number;

  @Column({ type: 'date' })
  date!: string;
}
