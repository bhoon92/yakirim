import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 훈련 회차 — "믿음학교 5기 3주차". 출석 체크의 단위. */
@Entity('training_session')
@Index(['churchId'])
@Index(['cohortId'])
@Index(['cohortId', 'sequence'], { unique: true, where: 'deleted_at IS NULL' })
export class TrainingSessionEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  cohortId!: number;

  @Column({ comment: '회차 번호 (1부터)', type: 'smallint' })
  sequence!: number;

  @Column({ type: 'date', nullable: true })
  date?: string;

  @Column({ comment: '주제/본문', nullable: true })
  topic?: string;
}
