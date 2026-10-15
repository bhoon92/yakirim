import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { In } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { CalendarEntity } from '@src/database/entities/calendar.entity';
import { CalendarSubscriptionEntity } from '@src/database/entities/calendar-subscription.entity';

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 14;

/** URL 단축용 짧은 토큰 (base62 14자 ≈ 83비트, 추측 불가). UUID(36자) 대체. */
function shortToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return token;
}

@Injectable()
export class SubscriptionService {
  private repo() {
    return DataSources.instance.getRepository(CalendarSubscriptionEntity);
  }

  /** 내 구독 조회 — 없으면 전체 달력 포함으로 생성. */
  async getOrCreate(churchId: number, accountId: number): Promise<CalendarSubscriptionEntity> {
    const existing = await this.repo().findOne({ where: { churchId, accountId } });
    if (existing) return existing;

    const calendars = await DataSources.instance.getRepository(CalendarEntity).find({ where: { churchId } });
    const row = this.repo().create({
      churchId,
      accountId,
      feedToken: shortToken(),
      calendarIds: calendars.map(calendar => calendar.id),
    });
    return this.repo().save(row);
  }

  /** 피드에 포함할 달력 목록 갱신 (해당 교회 달력만 허용). */
  async update(churchId: number, accountId: number, calendarIds: number[]): Promise<CalendarSubscriptionEntity> {
    const sub = await this.getOrCreate(churchId, accountId);
    const valid =
      calendarIds.length > 0
        ? await DataSources.instance.getRepository(CalendarEntity).find({ where: { id: In(calendarIds), churchId } })
        : [];
    sub.calendarIds = valid.map(calendar => calendar.id);
    return this.repo().save(sub);
  }

  /** 피드 토큰 재발급 (기존 구독 URL 무효화). */
  async regenerate(churchId: number, accountId: number): Promise<CalendarSubscriptionEntity> {
    const sub = await this.getOrCreate(churchId, accountId);
    sub.feedToken = shortToken();
    return this.repo().save(sub);
  }

  async findByToken(token: string): Promise<CalendarSubscriptionEntity> {
    const sub = await this.repo().findOne({ where: { feedToken: token } });
    if (!sub) throw new NotFoundException('구독을 찾을 수 없습니다.');
    return sub;
  }
}
