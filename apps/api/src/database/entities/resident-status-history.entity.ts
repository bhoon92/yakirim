import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 간사 상태 변경 이력 — 활동 → 안식 → 활동 → 퇴소 같은 흐름.
 *
 * 상태를 바꿀 때마다 한 줄씩 쌓인다. 잘못 남긴 줄은 지울 수 있고, 지워도 프로필의 현재 상태는 그대로다
 * (선교사 기록과 같은 규칙).
 */
@Entity('resident_status_history')
@Index(['churchId'])
@Index(['residentId'])
export class ResidentStatusHistoryEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  residentId!: number;

  @Column({ comment: '바뀐 상태 (resident_status)' })
  statusId!: number;

  @Column({ type: 'date' })
  date!: string;

  @Column({ comment: '사유', type: 'text', nullable: true })
  reason?: string | null;

  @Column({ comment: '작성자 account' })
  recorderAccountId!: number;
}
