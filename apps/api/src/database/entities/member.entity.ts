import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 성도 — 도메인 모델 root (헌금·출석·사역기록 1:N). */
@Entity('member')
@Index(['churchId'])
@Index(['churchId', 'statusId'])
export class MemberEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'date', nullable: true })
  birth?: string;

  @Column()
  statusId!: number;

  @Column({ comment: '비고/노트', type: 'text', nullable: true })
  note?: string;

  @Column({ comment: '정식 등록일', type: 'date', nullable: true })
  registeredAt?: string;

  @Column({ comment: '세례일', type: 'date', nullable: true })
  baptizedAt?: string;

  @Column({ comment: '입교일', type: 'date', nullable: true })
  confirmedAt?: string;

  // 새가족 등록서 (옵션 B: 별도 entity 안 만들고 nullable 컬럼 흡수)
  @Column({ comment: '이전 교회', nullable: true })
  previousChurch?: string;

  @Column({ comment: '신앙 경력 (년)', type: 'smallint', nullable: true })
  faithYears?: number;

  @Column({ comment: '등록 동기', type: 'text', nullable: true })
  registrationReason?: string;

  @Column({ comment: '직업', nullable: true })
  occupation?: string;

  @Column({ comment: '주소', nullable: true })
  address?: string;

  @Column({ comment: '봉투 원본 이름 (헌금 batch entry 매칭용)', nullable: true })
  rawDonorName?: string;
}
