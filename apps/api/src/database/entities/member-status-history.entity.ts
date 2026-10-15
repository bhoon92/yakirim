import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 재적상태 변경 이력 — 양성 파이프라인 **통과 기록**.
 *
 * `member.status_id` 는 현재값만 들고 있어서 "언제 훈련생이 됐나", "올해 정착에서
 * 훈련생으로 몇 명이 넘어갔나", "누가 새가족에 6개월째 머물러 있나" 를 답할 수 없었다.
 * 소속(member_department 등)·직분(member_position)은 이미 이력을 남기고 있었는데
 * 정작 파이프라인의 축인 재적상태만 빠져 있던 비대칭을 메운다.
 *
 * 열려 있는 행(end_date IS NULL)이 곧 현재 상태이며, member.status_id 와 항상 일치해야 한다.
 * 기록은 MemberStatusHistoryService.record() 한 곳에서만 만든다.
 */
@Entity('member_status_history')
@Index(['churchId'])
@Index(['memberId'])
@Index(['churchId', 'statusId'])
// 한 사람에게 열린 구간은 하나뿐이다. 닫고 나서 넣어야 충돌하지 않는다.
@Index(['memberId'], { unique: true, where: 'end_date IS NULL AND deleted_at IS NULL' })
export class MemberStatusHistoryEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column()
  statusId!: number;

  @Column({ comment: '이 상태가 시작된 날', type: 'date' })
  startDate!: string;

  @Column({ comment: '다음 상태로 넘어간 날. null 이면 현재 상태', type: 'date', nullable: true })
  endDate?: string | null;

  @Column({ comment: '변경 사유/메모', type: 'varchar', nullable: true })
  reason?: string | null;
}
