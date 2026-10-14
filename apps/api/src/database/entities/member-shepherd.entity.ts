import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 담당 간사 — 어느 간사가 이 성도를 맡아 양육하는지 (planning 00.7 "그다음").
 *
 * 간사 대부분이 직접 로그인해서 쓰므로 "내가 맡은 사람" 화면의 기준이 된다.
 * 한 성도에 담당은 **한 명**이다 — 책임이 흐려지지 않게. 바뀐 내력은 구간으로 남긴다
 * (재적상태 이력과 같은 모양: 열린 구간 = 지금 담당).
 */
@Entity('member_shepherd')
@Index(['churchId'])
@Index(['memberId'])
@Index(['churchId', 'residentId'])
// 한 성도에게 열린 구간은 하나뿐이다. 닫고 나서 넣어야 충돌하지 않는다.
@Index(['memberId'], { unique: true, where: 'end_date IS NULL AND deleted_at IS NULL' })
export class MemberShepherdEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column({ comment: '담당 간사 (resident_profile)' })
  residentId!: number;

  @Column({ comment: '담당 시작일', type: 'date' })
  startDate!: string;

  @Column({ comment: '담당이 끝난 날. null 이면 지금 담당', type: 'date', nullable: true })
  endDate?: string | null;
}
