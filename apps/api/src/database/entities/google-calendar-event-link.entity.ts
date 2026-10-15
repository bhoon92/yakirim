import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntity } from './base-date.entity';

/** 앱 일정 ↔ 구글 일정 매핑. */
@Entity('google_calendar_event_link')
@Index(['connectionId'])
@Index(['calendarEventId'])
@Index(['connectionId', 'calendarEventId'], { unique: true })
export class GoogleCalendarEventLinkEntity extends BaseDateEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  connectionId!: number;

  @Column()
  calendarEventId!: number;

  @Column({ comment: '구글 캘린더 일정 id' })
  googleEventId!: string;
}
