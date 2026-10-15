import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

export enum TrainingFormat {
  /** 매주 반복 (예: 믿음학교 12주). */
  WEEKLY = 'weekly',
  /** 3박4일 등 연속 일정 수련회. */
  RETREAT = 'retreat',
  /** 합숙형 집중 훈련. */
  INTENSIVE = 'intensive',
  ETC = 'etc',
}

/** 훈련 과정 정의 — 기수(cohort)를 반복해서 여는 틀. */
@Entity('training_course')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class TrainingCourseEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: TrainingFormat, default: TrainingFormat.WEEKLY })
  format!: TrainingFormat;

  @Column({ comment: '기본 회차 수 — 기수 개설 시 회차 자동 생성에 사용', type: 'smallint', default: 1 })
  defaultSessionCount!: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  /**
   * 훈련 사다리에서의 단계 번호 (STEP 1, 2 …). null = 사다리 밖 과정(여름 수련회 같은 일회성 훈련).
   * 정렬순서(sortOrder)와 따로 둔다 — 사다리 밖 과정이 끼어들면 순서만으로는 STEP 번호가 어긋난다.
   */
  @Column({ comment: '훈련 사다리 단계 번호 (null = 사다리 밖)', type: 'smallint', nullable: true })
  step?: number | null;

  /** 수료하면 올리기를 제안할 재적상태 (member_status). null = 제안 안 함. 자동 전환은 하지 않는다. */
  @Column({ comment: '수료 시 제안할 재적상태', type: 'int', nullable: true })
  completionStatusId?: number | null;

  /** 수료하면 공동체 간사 등록을 제안할지 (선교사학교처럼 간사로 이어지는 과정). */
  @Column({ comment: '수료 시 간사 등록 제안', default: false })
  completionSuggestsResident!: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true, comment: '직접 고른 아이콘(이모지). null 이면 이름으로 자동 배정' })
  icon?: string | null;
}
