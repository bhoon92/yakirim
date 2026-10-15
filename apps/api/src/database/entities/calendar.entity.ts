import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 달력 레이어 — 공지/부서/개인 등 구분 단위. */
@Entity('calendar')
@Index(['churchId'])
export class CalendarEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ comment: 'UI/구분용 색상 (oklch 또는 hex)' })
  color!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true, comment: '직접 고른 아이콘(이모지). null 이면 이름으로 자동 배정' })
  icon?: string | null;
}
