import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { daysBetween, toDateString, todayString } from '@src/common/date';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusHistoryEntity } from '@src/database/entities/member-status-history.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';

/** 한 사람의 상태 구간 하나. */
export type StatusPeriod = {
  id: number;
  statusId: number;
  statusName: string | null;
  startDate: string;
  endDate: string | null;
  /** 이 구간에 머문 일수. 열려 있으면 오늘까지. */
  days: number;
  reason: string | null;
};

/** 기준일수를 넘겨 같은 단계에 머물러 있는 사람. */
export type StalledMember = {
  memberId: number;
  memberName: string;
  statusId: number;
  statusName: string;
  since: string;
  days: number;
  /** 이 상태의 정체 기준 일수 */
  threshold: number;
};

/** 한 단계에서 다음 단계로 넘어간 건수 (기간 내). */
export type StageTransition = {
  fromStatusId: number | null;
  fromStatusName: string | null;
  toStatusId: number;
  toStatusName: string;
  count: number;
};

@Injectable()
export class MemberStatusHistoryService {
  private repo(manager?: EntityManager) {
    return (manager ?? DataSources.instance.manager).getRepository(MemberStatusHistoryEntity);
  }

  private today(): string {
    return todayString();
  }

  /**
   * 상태 전환을 기록한다. **재적상태를 바꾸는 모든 경로가 이 함수를 거쳐야 한다.**
   *
   * - 열린 구간이 이미 같은 상태면 아무것도 하지 않는다(중복 저장 방지).
   * - 열린 구간이 있으면 먼저 닫고 새로 연다. 순서가 중요하다 —
   *   (member_id) WHERE end_date IS NULL 부분 유니크 인덱스가 걸려 있어
   *   닫기 전에 새 행을 넣으면 충돌한다.
   */
  async record(
    manager: EntityManager,
    churchId: number,
    memberId: number,
    statusId: number,
    options?: { date?: string; reason?: string | null }
  ): Promise<void> {
    const date = options?.date ?? this.today();
    const repo = this.repo(manager);

    const open = await repo.findOne({ where: { churchId, memberId, endDate: IsNull() } });
    if (open) {
      if (open.statusId === statusId) return;
      await repo.update({ id: open.id }, { endDate: date });
    }

    await repo.save(repo.create({ churchId, memberId, statusId, startDate: date, reason: options?.reason ?? null }));
  }

  /** 교인 한 명의 단계 이동 이력 (오래된 순). */
  async listFor(churchId: number, memberId: number): Promise<StatusPeriod[]> {
    const [rows, statuses] = await Promise.all([
      this.repo().find({ where: { churchId, memberId }, order: { startDate: 'ASC', id: 'ASC' } }),
      DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } }),
    ]);
    const nameById = new Map(statuses.map(status => [status.id, status.name]));
    const today = this.today();

    return rows.map(row => ({
      id: row.id,
      statusId: row.statusId,
      statusName: nameById.get(row.statusId) ?? null,
      startDate: row.startDate,
      endDate: row.endDate ?? null,
      days: daysBetween(row.startDate, row.endDate ?? today),
      reason: row.reason ?? null,
    }));
  }

  /**
   * 정체된 사람 — 현재 상태에 그 상태의 `stallsAfterDays` 이상 머물러 있는 사람.
   * 오래 머문 순. `stallsAfterDays` 가 null 인 상태(도착점·이탈)는 애초에 제외된다.
   */
  async listStalled(churchId: number, limit?: number): Promise<StalledMember[]> {
    const rows = (await this.repo()
      .createQueryBuilder('h')
      .innerJoin(MemberEntity, 'm', 'm.id = h.memberId AND m.deleted_at IS NULL')
      .innerJoin(MemberStatusEntity, 's', 's.id = h.statusId')
      .select([
        'h.member_id AS "memberId"',
        'm.name AS "memberName"',
        'h.status_id AS "statusId"',
        's.name AS "statusName"',
        'h.start_date AS "since"',
        's.stalls_after_days AS "threshold"',
      ])
      .where('h.church_id = :churchId', { churchId })
      .andWhere('h.end_date IS NULL')
      .andWhere('s.stalls_after_days IS NOT NULL')
      .andWhere("h.start_date <= CURRENT_DATE - (s.stalls_after_days || ' days')::interval")
      .orderBy('h.start_date', 'ASC')
      .limit(limit)
      .getRawMany()) as { memberId: number; memberName: string; statusId: number; statusName: string; since: string; threshold: number }[];

    const today = this.today();
    return rows.map(row => ({
      memberId: Number(row.memberId),
      memberName: row.memberName,
      statusId: Number(row.statusId),
      statusName: row.statusName,
      since: toDateString(row.since),
      days: daysBetween(toDateString(row.since), today),
      threshold: Number(row.threshold),
    }));
  }

  /** 기간 내 단계 이동 집계 — "올해 정착에서 훈련생으로 몇 명 넘어갔나". */
  async transitions(churchId: number, from: string, to: string): Promise<StageTransition[]> {
    const statuses = await DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } });
    const nameById = new Map(statuses.map(status => [status.id, status.name]));

    // 기간 안에 시작된 구간이 곧 "그 단계로 들어온 것". 직전 구간이 출발 단계다.
    const rows = (await this.repo()
      .createQueryBuilder('h')
      .leftJoin(
        MemberStatusHistoryEntity,
        'prev',
        'prev.member_id = h.member_id AND prev.end_date = h.start_date AND prev.deleted_at IS NULL'
      )
      .select(['prev.status_id AS "fromStatusId"', 'h.status_id AS "toStatusId"', 'COUNT(*) AS "cnt"'])
      .where('h.church_id = :churchId', { churchId })
      .andWhere('h.start_date >= :from AND h.start_date <= :to', { from, to })
      .groupBy('prev.status_id')
      .addGroupBy('h.status_id')
      .getRawMany()) as { fromStatusId: number | null; toStatusId: number; cnt: string }[];

    return rows
      .map(row => ({
        fromStatusId: row.fromStatusId === null ? null : Number(row.fromStatusId),
        fromStatusName: row.fromStatusId === null ? null : (nameById.get(Number(row.fromStatusId)) ?? null),
        toStatusId: Number(row.toStatusId),
        toStatusName: nameById.get(Number(row.toStatusId)) ?? '',
        count: Number(row.cnt),
      }))
      .sort((a, b) => b.count - a.count);
  }
}
