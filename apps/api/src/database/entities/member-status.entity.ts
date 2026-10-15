import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 재적상태 reference (교회별 편집 가능).
 * 키퍼스처치 기준에서는 단순 분류가 아니라 **양성 파이프라인 그 자체**다:
 * 방문 → 새가족 → 정착 → 훈련생 → 사역자 → 파송 (planning 00.2).
 */
@Entity('member_status')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class MemberStatusEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  /**
   * 시스템 의미 키. 있으면 사용자 삭제 불가.
   * 'anonymous'(무명헌금) | 'new'(새가족) | 'trainee'(훈련생) | 'worker'(사역자) | 'commissioned'(파송) | null
   */
  @Column({ type: 'varchar', nullable: true })
  systemKey?: string;

  /** 출석 명단 포함 여부 (별세·이명·익명·파송은 false — 파송자는 현지에 있어 주일 출석 대상이 아니다). */
  @Column({ default: true })
  countsInRoster!: boolean;

  /**
   * 이 상태에 며칠 이상 머무르면 "정체"로 볼지. null 이면 정체 판정에서 제외한다.
   *
   * 단계마다 자연스러운 체류 기간이 다르다(방문 한 달 ↔ 훈련생 여덟 달). 그래서 전역 기준
   * 하나가 아니라 상태별 값으로 둔다. 파송·이명·별세처럼 **도착점인 상태는 null** 이다 —
   * 오래 머무르는 게 정상이라 정체가 아니다.
   */
  @Column({ comment: '정체 판정 기준 일수. null 이면 판정하지 않음', type: 'smallint', nullable: true })
  stallsAfterDays?: number | null;
}
