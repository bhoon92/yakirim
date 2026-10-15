import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 부서 — 유치원·카페 등 **상설 기관** reference (연령 부서 아님. planning 00.5). */
@Entity('department')
@Index(['churchId'])
@Index(['churchId', 'year'])
@Index(['churchId', 'year', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class DepartmentEntity extends BaseDateEntityWithDeletedAt {
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
