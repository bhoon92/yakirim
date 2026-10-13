import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 공동체 간사 프로필 — 공동생활을 하며 내부에서 섬기는 선교사(다윗의열쇠 선교사). 교인 1명당 최대 1개.
 *
 * 해외 파송(missionary_profile)과 따로 둔다. 관리 주체(기획행정팀 vs 해외선교팀)도, 보는 항목
 * (입주·하우스 vs 파송국가·출국일)도 다르다. 한 사람이 간사였다가 파송되면 둘 다 가질 수 있다.
 *
 * 하우스·사역팀·역할은 여기 두지 않는다 — 교인의 소속·사역 역할 이력을 그대로 읽는다.
 * 현재 상태는 여기(statusId), 상태가 어떻게 바뀌어 왔는지는 resident_status_history 에.
 */
@Entity('resident_profile')
@Index(['churchId'])
@Index(['churchId', 'statusId'])
@Index(['memberId'], { unique: true, where: 'deleted_at IS NULL' })
export class ResidentProfileEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  memberId!: number;

  @Column({ comment: '현재 상태 (resident_status)', type: 'int', nullable: true })
  statusId?: number | null;

  @Column({ comment: '공동체 입주일', type: 'date', nullable: true })
  joinedAt?: string | null;

  @Column({ comment: '헌신(간사 사역) 시작일', type: 'date', nullable: true })
  committedAt?: string | null;

  @Column({ comment: '퇴소일', type: 'date', nullable: true })
  leftAt?: string | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;
}
