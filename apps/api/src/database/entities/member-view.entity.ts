import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 교인 명부에서 저장해 두는 필터 묶음 — 노션 데이터베이스의 보기 탭처럼 교회 전체가 함께 쓴다. */
export type MemberViewFilters = {
  q?: string;
  statusId?: number;
  affiliationKind?: 'department' | 'ministry' | 'smallGroup' | 'table';
  affiliationId?: number;
  stalled?: boolean;
  /** 담당 간사 resident id, 또는 'none' = 담당 없음 */
  shepherd?: number | 'none';
};

@Entity('member_view')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class MemberViewEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column({ length: 40, comment: '보기 이름 (예: 담당 없는 새가족)' })
  name!: string;

  @Column({ type: 'jsonb', comment: '교인 목록 필터 — MemberViewFilters' })
  filters!: MemberViewFilters;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ type: 'int', nullable: true, comment: '만든 계정' })
  createdByAccountId?: number | null;
}
