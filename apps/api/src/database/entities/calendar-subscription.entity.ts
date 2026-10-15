import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseDateEntity } from './base-date.entity';
/** 사용자별 iCal 피드 구독. */
@Entity('calendar_subscription')
@Index(['feedToken'], { unique: true })
@Index(['accountId', 'churchId'], { unique: true })
export class CalendarSubscriptionEntity extends BaseDateEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  accountId!: number;

  @Column({ comment: 'iCal 피드 접근 토큰 (URL 내 secret)' })
  feedToken!: string;

  @Column({ type: 'int', array: true, default: () => "'{}'" })
  calendarIds!: number[];
}
