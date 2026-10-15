import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 훈련 회차 출석 — 예배 출석(attendance)과 별도 테이블.
 * 집계 단위가 "기수 × 회차 × 수강자"라 예배 출석과 섞지 않는다 (planning 00.3).
 */
@Entity('training_attendance')
@Index(['churchId'])
@Index(['sessionId'])
@Index(['enrollmentId'])
@Index(['sessionId', 'enrollmentId'], { unique: true, where: 'deleted_at IS NULL' })
export class TrainingAttendanceEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  sessionId!: number;

  @Column()
  enrollmentId!: number;
}
