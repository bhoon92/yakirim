import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 간사가 맡은 사역 — 노션 다중 선택의 "옵션"에 해당한다 (카페 운영, 주일 찬양 인도, 재정 …).
 *
 * 사역팀(ministry)과 다르다. 사역팀은 조직도·예산이 붙는 공식 조직이라 설정에서 먼저 만들어야 하지만,
 * 이건 간사 화면에서 이름을 적는 순간 생기는 가벼운 태그다. 맡은 일이 수시로 바뀌기 때문이다.
 */
@Entity('resident_duty')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class ResidentDutyEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;
}
