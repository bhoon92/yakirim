import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 로그인 계정 — Google OAuth 인증 주체. */
@Entity('account')
@Index(['googleId'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['email'], { unique: true, where: 'deleted_at IS NULL' })
export class AccountEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ comment: 'Google sub' })
  googleId!: string;

  @Column()
  email!: string;

  @Column()
  name!: string;

  @Column({ comment: 'Google profile picture URL', nullable: true })
  pictureUrl?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;
}
