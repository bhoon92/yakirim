import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntityWithDeletedAt } from './base-date.entity';

/**
 * 양육기록 종류 reference — 심방/면담/양육/상담/파송보고 등.
 *
 * 원래 `care_note.type` enum 이었는데 기준정보로 뺐다. 코드가 이 값을 보고 분기하는 곳이
 * 한 곳도 없었다 — 기본값·입력검증·라벨 표시가 전부였다. 즉 enum 이 동작상 얻는 게 없으면서
 * 교회가 자기 용어("새가족 커피챗" 등)를 못 쓰게 막고만 있었다.
 * 재적상태·선교사 단계와 같은 결론이다 (HANDOFF §5).
 */
@Entity('care_note_type')
@Index(['churchId'])
@Index(['churchId', 'name'], { unique: true, where: 'deleted_at IS NULL' })
export class CareNoteTypeEntity extends BaseDateEntityWithDeletedAt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'smallint', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  /**
   * 코드가 지목해야 할 때를 위한 키. **지금은 아무도 쓰지 않는다.**
   * "파송보고만 선교사 화면에 모아 보기" 같은 게 생기면 이름이 바뀌어도 찾을 수 있게 미리 둔다
   * (member_status.systemKey 와 같은 장치). 값이 있으면 사용자 삭제 불가.
   */
  @Column({ type: 'varchar', nullable: true })
  systemKey?: string | null;
}
