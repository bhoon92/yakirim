import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/** 심방 기록 양식 — "새가족 첫 심방" 처럼 자주 쓰는 틀을 저장해 두고 새 기록에 채운다. 교회 전체가 함께 쓴다. */
@Entity('care_note_template')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class CareNoteTemplateEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column({ length: 40, comment: '양식 이름' })
  name!: string;

  @Column({ type: 'int', nullable: true, comment: '기본 기록 종류 (care_note_type). null 이면 고르지 않음' })
  typeId?: number | null;

  @Column({ type: 'text', comment: '본문 틀' })
  content!: string;

  @Column({ type: 'text', nullable: true, comment: '기도제목 틀' })
  prayerRequest?: string | null;

  @Column({ type: 'text', nullable: true, comment: '현재 상황 틀' })
  statusNote?: string | null;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;
}
