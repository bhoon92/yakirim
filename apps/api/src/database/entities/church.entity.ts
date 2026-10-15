import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

export enum ChurchStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  SUSPENDED = 'suspended',
}

/** 교회 — 멀티테넌트 root. */
@Entity('church')
@Index(['slug'], { unique: true, where: 'deleted_at IS NULL' })
export class ChurchEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ comment: '교회 url slug — 추후 도메인/링크 등에 사용', nullable: true })
  slug?: string;

  @Column({ comment: '사업자등록번호 / 고유번호 — 영수증 발급 주체', nullable: true })
  registrationNumber?: string;

  @Column({ comment: '대표자(담임목사)', nullable: true })
  representative?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ comment: '로고 storage key', nullable: true })
  logoUrl?: string;

  @Column({ comment: '기본 회계연도 시작월 (1-12)', type: 'smallint', default: 1 })
  fiscalYearStartMonth!: number;

  @Column({ type: 'enum', enum: ChurchStatus, default: ChurchStatus.TRIAL })
  status!: ChurchStatus;

  /**
   * 조직 대분류를 이 교회에서 부르는 이름. null 이면 코드 기본값(기관/사역팀/공동체)을 쓴다.
   *
   * 대분류 자체는 3종 고정이다 — 각각 테이블·소속 이력·예산 배정 대상이 따로 있어서
   * 개수를 바꾸려면 스키마를 갈아야 한다. 반면 "뭐라고 부르는가"는 교회마다 다르므로
   * (부서/구역/목장/셀…) 표시 이름만 교회별로 저장한다.
   */
  @Column({ comment: '기관 대분류의 교회별 표시 이름', type: 'varchar', nullable: true })
  departmentLabel?: string | null;

  @Column({ comment: '사역팀 대분류의 교회별 표시 이름', type: 'varchar', nullable: true })
  ministryLabel?: string | null;

  @Column({ comment: '공동체 대분류의 교회별 표시 이름', type: 'varchar', nullable: true })
  smallGroupLabel?: string | null;
}
