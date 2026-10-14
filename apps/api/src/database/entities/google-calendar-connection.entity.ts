import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { encryptedText } from '@src/util/token-cipher';
import { BaseDateEntity } from './base-date.entity';

/** Google Calendar push 연동 — account+church 단위 연결. */
@Entity('google_calendar_connection')
@Index(['churchId'])
@Index(['accountId', 'churchId'], { unique: true })
export class GoogleCalendarConnectionEntity extends BaseDateEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  churchId!: number;

  @Column()
  accountId!: number;

  @Column({ comment: '연결한 구글 계정 이메일' })
  googleEmail!: string;

  @Column({ type: 'text', comment: 'offline refresh token (AES-256-GCM 암호화)', transformer: encryptedText })
  refreshToken!: string;

  @Column({ type: 'text', nullable: true, comment: '캐시된 access token (AES-256-GCM 암호화)', transformer: encryptedText })
  accessToken?: string | null;

  @Column({ type: 'timestamptz', nullable: true, comment: 'access token 만료 시각' })
  accessTokenExpiresAt?: Date | null;

  @Column({ comment: 'push 대상 구글 캘린더 id' })
  targetCalendarId!: string;

  @Column({ type: 'int', array: true, default: () => "'{}'", comment: 'push 할 앱 calendar 레이어 (빈 배열=전체)' })
  calendarId!: number[];

  @Column({ default: true })
  isActive!: boolean;
}
