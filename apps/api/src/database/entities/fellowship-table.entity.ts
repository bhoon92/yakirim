import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 테이블 — 예배 후 성도들끼리 나누는 자리 (다른 교회의 셀·목장 모임에 해당 — 키퍼스처치에는 목장이 없고 테이블이 그 자리다). 테이블 리더는 일반 성도가 맡는다.
 * 간사 공동생활 단위인 공동체(하우스, small_group)와는 따로 둔다 — 한 사람이 하우스와 테이블에 함께 속할 수 있다.
 * SQL 예약어 `table` 을 피해 `fellowship_table` 로 둔다.
 */
@Entity('fellowship_table')
@Index(['churchId'])
@Index(['churchId', 'year'])
@Index(['churchId', 'year', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class FellowshipTableEntity extends BaseDateEntityWithDeletedAt {
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
