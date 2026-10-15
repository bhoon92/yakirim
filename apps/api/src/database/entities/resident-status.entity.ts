import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 간사 상태 reference (교회별 편집 가능) — 활동 / 안식 / 퇴소 …
 *
 * 선교사 단계와 같은 구조다. 이름은 교회가 정하고, 코드가 아는 건 countsAsActive 하나뿐이다.
 */
@Entity('resident_status')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class ResidentStatusEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  /** 이 상태에 있는 사람을 "지금 공동체에 있는 간사"로 셀지. 간사 화면 기본 목록·인원 집계 기준. */
  @Column({ comment: '현재 공동체 인원으로 집계할 상태인지', default: false })
  countsAsActive!: boolean;
}
