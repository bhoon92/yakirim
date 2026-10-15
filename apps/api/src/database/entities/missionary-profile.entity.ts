import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 선교사 프로필 — 교인 1명당 최대 1개.
 * 현재 단계는 여기(stageId), 그동안의 기록은 missionary_note 에.
 * 단계 목록 자체는 교회별 기준정보(missionary_stage)라 코드가 특정 이름을 알지 못한다.
 */
@Entity('missionary_profile')
@Index(['churchId'])
@Index(['churchId', 'stageId'])
@Index(['memberId'], { unique: true, where: 'deleted_at IS NULL' })
export class MissionaryProfileEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  /** 현재 단계. 미지정(null) 상태도 허용한다 — 교회가 단계를 안 쓰거나 아직 안 정한 경우. */
  @Column({ comment: '현재 단계 (missionary_stage)', type: 'int', nullable: true })
  stageId?: number | null;

  @Column({ comment: '파송 국가', nullable: true })
  country?: string;

  @Column({ comment: '지역/도시', nullable: true })
  region?: string;

  @Column({ comment: '사역 내용 요약', type: 'text', nullable: true })
  fieldWork?: string;

  @Column({ comment: '소속 사역팀 (보통 해외선교팀)', nullable: true })
  ministryId?: number;

  @Column({ comment: '파송 확정일 — 파송 집계 단계 첫 진입 시 자동 기록, 이후 직접 수정 가능', type: 'date', nullable: true })
  commissionedAt?: string | null;

  @Column({ comment: '출국/현지 도착일', type: 'date', nullable: true })
  departedAt?: string | null;

  @Column({ comment: '복귀/종료일', type: 'date', nullable: true })
  endedAt?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string;
}
