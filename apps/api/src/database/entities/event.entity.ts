import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 행사 — 갤러리 사진 폴더 단위. */
@Entity('event')
@Index(['churchId'])
@Index(['churchId', 'date'])
export class EventEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ type: 'date', nullable: true })
  date?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ type: 'varchar', length: 16, nullable: true, comment: '직접 고른 아이콘(이모지). null 이면 이름으로 자동 배정' })
  icon?: string | null;
}
