import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

export enum CohortStatus {
  PLANNED = 'planned',
  ONGOING = 'ongoing',
  CLOSED = 'closed',
}

/**
 * 훈련 기수 — "믿음학교 5기". 실제 사람이 붙는 단위.
 *
 * 이름은 담당자가 직접 적는다. 예전에는 `ordinal`(숫자)을 시스템이 자동 채번했는데,
 * 교회가 "2026 봄학기" 나 "청년부 집중과정" 처럼 부르는 경우를 담을 수 없었다.
 */
@Entity('training_cohort')
@Index(['churchId'])
@Index(['churchId', 'status'])
@Index(['courseId'])
// 같은 과정 안에서 이름이 겹치면 목록에서 구분이 안 된다.
@Index(['courseId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class TrainingCohortEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  courseId!: number;

  @Column({ comment: '기수 이름 (5기 / 2026 봄학기 …). 담당자가 직접 적는다' })
  name!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ comment: '종료(예정)일', type: 'date', nullable: true })
  endDate?: string;

  @Column({ type: 'enum', enum: CohortStatus, default: CohortStatus.PLANNED })
  status!: CohortStatus;

  @Column({ comment: '담당 사역자 (member)', nullable: true })
  leaderMemberId?: number;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
