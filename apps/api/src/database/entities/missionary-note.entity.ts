import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 선교사 기록 — 구 missionary_stage_history.
 *
 * 단계 이동 버튼이 이력을 자동으로 쌓던 방식을 버렸다. 기록의 주인공은 **메모**이고,
 * 단계는 "이 기록 시점에 단계가 바뀌었다면" 함께 남기는 선택 항목이다(비워도 된다).
 * 단계를 지정해 저장하면 프로필의 현재 단계도 그 값으로 갱신된다.
 */
@Entity('missionary_note')
@Index(['churchId'])
@Index(['missionaryId'])
@Index(['churchId', 'date'])
export class MissionaryNoteEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  missionaryId!: number;

  @Column({ comment: '메모 본문', type: 'text' })
  content!: string;

  /** 이 기록 시점의 단계. null = 단계 변화 없이 메모만 남긴 경우. */
  @Column({ comment: '이 시점의 단계 (선택)', type: 'int', nullable: true })
  stageId?: number | null;

  @Column({ type: 'date' })
  date!: string;

  @Column({ comment: '작성자 account' })
  recorderAccountId!: number;
}
