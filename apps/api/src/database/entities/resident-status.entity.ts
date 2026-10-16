import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 간사 트랙에서 상태가 속한 구간. 노션 status 속성의 할 일/진행 중/완료 묶음과 같은 역할이다.
 * - preparing: 진입 준비 (지원 · 면담 · 훈련·선교 과정 …) — 아직 간사가 아니다
 * - resident: 공동체 간사 (활동 · 안식 …) — 인원 집계 대상
 * - left: 떠남 (퇴소 · 중단 …)
 * 성도와 간사는 2트랙이다 — 간사는 성도 단계의 다음 칸이 아니라 이 진입 구간을 따로 거친다 (2026-10-16 사용자).
 */
export enum ResidentPhase {
  PREPARING = 'preparing',
  RESIDENT = 'resident',
  LEFT = 'left',
}

/**
 * 간사 상태 reference (교회별 편집 가능) — 지원 / 면담 / … / 활동 / 안식 / 퇴소.
 *
 * 이름·순서는 교회가 정하고(노션 칸반의 status 처럼), 코드가 아는 건 구간(phase) 하나다.
 * countsAsActive 는 phase === resident 와 같게 서비스가 맞춘다(예전 클라이언트·집계 코드 호환).
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

  @Column({
    type: 'varchar',
    length: 16,
    default: ResidentPhase.RESIDENT,
    comment: '구간 — preparing 진입 준비 / resident 간사 / left 떠남',
  })
  phase!: ResidentPhase;

  /** 이 상태에 있는 사람을 "지금 공동체에 있는 간사"로 셀지. 간사 화면 기본 목록·인원 집계 기준. phase 에서 정해진다. */
  @Column({ comment: '현재 공동체 인원으로 집계할 상태인지', default: false })
  countsAsActive!: boolean;
}
