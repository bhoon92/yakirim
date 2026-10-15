import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 선교사 단계 reference (교회별 편집 가능).
 *
 * 파송 절차는 교회마다 다르므로 코드에 enum 으로 박지 않는다. 후보/훈련/파송확정/현지/안식년/복귀 는
 * 어디까지나 기본 시드값이고, 교회가 이름·순서·개수를 바꿀 수 있다.
 * 대시보드 집계와 재적상태 연동은 단계 **이름이 아니라 아래 countsAsActive 플래그**로 판단한다.
 */
@Entity('missionary_stage')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class MissionaryStageEntity extends BaseDateEntityWithDeletedAt {
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

  /**
   * 이 단계에 있는 사람을 "현재 파송 중"으로 셀지 여부.
   * - 대시보드 '현재 파송 인원' 집계 기준
   * - 이 단계로 처음 진입할 때 파송 확정일(commissionedAt)이 비어 있으면 그날로 채운다
   * - 교인의 재적상태를 '파송'(출석 명단 제외)으로 전환하는 트리거
   */
  @Column({ comment: '현재 파송 중으로 집계할 단계인지', default: false })
  countsAsActive!: boolean;
}
