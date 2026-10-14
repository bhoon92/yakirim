import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

export enum MembershipRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  STAFF = 'staff',
  VIEWER = 'viewer',
}

/** 계정 ↔ 교회 소속 + 역할(RBAC). */
@Entity('membership')
@Index(['accountId', 'churchId'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['churchId'])
export class MembershipEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountId!: number;

  @Column()
  churchId!: number;

  @Column({ type: 'enum', enum: MembershipRole, default: MembershipRole.STAFF })
  role!: MembershipRole;

  /** 이 계정이 교인 명부의 누구인지. 간사의 "내가 맡은 사람"이 이걸로 그 사람을 찾는다. */
  @Column({ type: 'int', nullable: true })
  memberId?: number | null;
}
