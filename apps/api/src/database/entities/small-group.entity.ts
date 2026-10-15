import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 공동체(하우스) — 공동생활 단위 reference (구 '목장/구역'. planning 00.5). */
@Entity('small_group')
@Index(['churchId'])
@Index(['churchId', 'year'])
@Index(['churchId', 'year', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class SmallGroupEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column({ type: 'smallint', comment: '편성 연도' })
  year!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;
}
