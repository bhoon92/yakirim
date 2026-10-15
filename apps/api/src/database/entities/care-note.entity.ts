import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 양육기록 — 심방·면담·양육·상담·파송보고 노트 (구 pastoral_record).
 *
 * 종류(`typeId`)는 **교회가 편집하는 기준정보**다(care_note_type). 예전엔 enum 이었는데
 * 코드가 그 값으로 분기하는 곳이 하나도 없어서, 교회 용어만 막고 있었다.
 */
@Entity('care_note')
@Index(['churchId'])
@Index(['memberId'])
@Index(['churchId', 'date'])
export class CareNoteEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column({ comment: '대상 교인' })
  memberId!: number;

  @Column({ comment: '작성자 account' })
  recorderAccountId!: number;

  @Column({ comment: '기록 종류 (care_note_type)' })
  typeId!: number;

  @Column({ type: 'date' })
  date!: string;

  @Column({ comment: '장소', nullable: true })
  location?: string;

  @Column({ comment: '본문', type: 'text' })
  content!: string;

  @Column({ comment: '기도제목', type: 'text', nullable: true })
  prayerRequest?: string;

  @Column({ comment: '현재 상황 노트', type: 'text', nullable: true })
  statusNote?: string;
}
