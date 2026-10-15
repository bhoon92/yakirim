import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { daysBetween, todayString } from '@src/common/date';
import { DataSources } from '@src/database/data-sources';
import { CareNoteEntity } from '@src/database/entities/care-note.entity';
import { MemberShepherdEntity } from '@src/database/entities/member-shepherd.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MembershipEntity } from '@src/database/entities/membership.entity';
import { ResidentProfileEntity } from '@src/database/entities/resident-profile.entity';

/** 목록 태그용 — 이 성도의 지금 담당. */
export type ShepherdTag = { residentId: number; name: string };

export type ShepherdPeriod = {
  id: number;
  residentId: number;
  residentName: string | null;
  startDate: string;
  endDate: string | null;
};

/** 간사 한 명이 맡은 성도 한 명 — "내가 맡은 사람" 화면의 한 줄. */
export type FlockMember = {
  memberId: number;
  memberName: string;
  phone: string | null;
  statusName: string | null;
  /** 담당 시작일 */
  since: string;
  /** 마지막 양육기록 날짜 — 오래 비어 있으면 연락이 끊긴 사람이다 */
  lastCareNoteDate: string | null;
  /** 마지막 양육기록 이후 지난 날수. 기록이 없으면 담당 시작일부터. */
  daysSinceContact: number;
};

/**
 * 담당 간사 ↔ 성도. 한 성도에 담당은 한 명, 바뀐 내력은 구간으로 남긴다.
 *
 * 교인·간사 모듈 양쪽이 쓰므로 둘 다에 기대지 않는 별도 모듈로 둔다 (순환 의존 방지).
 */
@Injectable()
export class ShepherdService {
  private repo(manager?: EntityManager) {
    return (manager ?? DataSources.instance.manager).getRepository(MemberShepherdEntity);
  }

  /**
   * 담당을 정한다. residentId 가 null 이면 담당 해제.
   * 지금 담당과 같으면 아무것도 하지 않는다. 다르면 열린 구간을 닫고 새로 연다 (닫고 나서 열어야 부분 유니크에 안 걸린다).
   */
  async assign(churchId: number, memberIds: number[], residentId: number | null, date = todayString()): Promise<{ changed: number }> {
    if (memberIds.length === 0) return { changed: 0 };
    if (residentId !== null) await this.assertResident(churchId, residentId);
    const members = await DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(memberIds) } });
    if (members.length !== new Set(memberIds).size) throw new NotFoundException('교인을 찾을 수 없습니다.');

    let changed = 0;
    await DataSources.instance.transaction(async manager => {
      const repo = this.repo(manager);
      for (const memberId of new Set(memberIds)) {
        const open = await repo.findOne({ where: { churchId, memberId, endDate: IsNull() } });
        if (open?.residentId === residentId) continue;
        if (!open && residentId === null) continue;
        if (open) await repo.update({ id: open.id }, { endDate: date });
        if (residentId !== null) await repo.save(repo.create({ churchId, memberId, residentId, startDate: date }));
        changed += 1;
      }
    });
    return { changed };
  }

  /** 간사가 빠질 때(간사 목록에서 제거) 그 간사의 담당 구간을 닫는다 — 맡은 성도가 "담당 없음"으로 돌아온다. */
  async endAllFor(manager: EntityManager, churchId: number, residentId: number): Promise<void> {
    await this.repo(manager).update({ churchId, residentId, endDate: IsNull() }, { endDate: todayString() });
  }

  async forMember(churchId: number, memberId: number): Promise<{ current: ShepherdPeriod | null; history: ShepherdPeriod[] }> {
    const rows = await this.repo().find({ where: { churchId, memberId }, order: { startDate: 'DESC', id: 'DESC' } });
    const names = await this.residentNames(
      churchId,
      rows.map(row => row.residentId)
    );
    const history = rows.map(row => ({
      id: row.id,
      residentId: row.residentId,
      residentName: names.get(row.residentId) ?? null,
      startDate: row.startDate,
      endDate: row.endDate ?? null,
    }));
    return { current: history.find(row => row.endDate === null) ?? null, history };
  }

  /** 목록 태그용 배치 조회. */
  async currentForMembers(churchId: number, memberIds: number[]): Promise<Map<number, ShepherdTag>> {
    const result = new Map<number, ShepherdTag>();
    if (memberIds.length === 0) return result;
    const rows = await this.repo().find({ where: { churchId, memberId: In(memberIds), endDate: IsNull() } });
    const names = await this.residentNames(
      churchId,
      rows.map(row => row.residentId)
    );
    for (const row of rows) result.set(row.memberId, { residentId: row.residentId, name: names.get(row.residentId) ?? '(이름 없음)' });
    return result;
  }

  /** 간사별 지금 맡은 인원. */
  async countsByResident(churchId: number): Promise<Map<number, number>> {
    const rows = await this.repo()
      .createQueryBuilder('s')
      .select('s.resident_id', 'residentId')
      .addSelect('COUNT(*)::int', 'count')
      .where('s.church_id = :churchId', { churchId })
      .andWhere('s.end_date IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .groupBy('s.resident_id')
      .getRawMany<{ residentId: number; count: number }>();
    return new Map(rows.map(row => [row.residentId, row.count]));
  }

  /** 간사 한 명이 지금 맡은 성도 — 연락한 지 오래된 사람이 위로 온다. */
  async flock(churchId: number, residentId: number): Promise<FlockMember[]> {
    await this.assertResident(churchId, residentId);
    const rows = await this.repo().find({ where: { churchId, residentId, endDate: IsNull() } });
    if (rows.length === 0) return [];
    const memberIds = rows.map(row => row.memberId);

    const [members, statuses, lastNotes] = await Promise.all([
      DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(memberIds) } }),
      DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } }),
      DataSources.instance
        .getRepository(CareNoteEntity)
        .createQueryBuilder('n')
        .select('n.member_id', 'memberId')
        .addSelect(`TO_CHAR(MAX(n.date), 'YYYY-MM-DD')`, 'last')
        .where('n.church_id = :churchId', { churchId })
        .andWhere('n.member_id IN (:...memberIds)', { memberIds })
        .andWhere('n.deleted_at IS NULL')
        .groupBy('n.member_id')
        .getRawMany<{ memberId: number; last: string }>(),
    ]);
    const memberMap = new Map(members.map(member => [member.id, member]));
    const statusMap = new Map(statuses.map(status => [status.id, status.name]));
    const lastMap = new Map(lastNotes.map(row => [row.memberId, row.last]));
    const today = todayString();

    return (
      rows
        .filter(row => memberMap.has(row.memberId))
        .map(row => {
          const member = memberMap.get(row.memberId)!;
          const last = lastMap.get(row.memberId) ?? null;
          return {
            memberId: member.id,
            memberName: member.name,
            phone: member.phone ?? null,
            statusName: statusMap.get(member.statusId) ?? null,
            since: row.startDate,
            lastCareNoteDate: last,
            daysSinceContact: daysBetween(last ?? row.startDate, today),
          };
        })
        // 기록이 아예 없는 사람이 먼저 — 같은 날수라도 "만난 적 없음"이 "오늘 만남"보다 급하다
        .sort(
          (a, b) =>
            Number(a.lastCareNoteDate !== null) - Number(b.lastCareNoteDate !== null) ||
            b.daysSinceContact - a.daysSinceContact ||
            a.memberName.localeCompare(b.memberName, 'ko')
        )
    );
  }

  /**
   * 로그인한 계정의 "내가 맡은 사람". 계정 ↔ 교인 연결이 없거나 그 교인이 간사가 아니면 residentId 가 null 이다
   * (화면은 그때 무엇을 해야 하는지 안내한다).
   */
  async forAccount(churchId: number, accountId: number): Promise<{ residentId: number | null; flock: FlockMember[] }> {
    const membership = await DataSources.instance.getRepository(MembershipEntity).findOne({ where: { accountId, churchId } });
    if (!membership?.memberId) return { residentId: null, flock: [] };
    const resident = await DataSources.instance
      .getRepository(ResidentProfileEntity)
      .findOne({ where: { churchId, memberId: membership.memberId } });
    if (!resident) return { residentId: null, flock: [] };
    return { residentId: resident.id, flock: await this.flock(churchId, resident.id) };
  }

  /** 간사 이름 = 그 간사 교인의 이름. 지운 간사도 이력에는 이름이 보이도록 withDeleted. */
  private async residentNames(churchId: number, residentIds: number[]): Promise<Map<number, string>> {
    const ids = Array.from(new Set(residentIds));
    if (ids.length === 0) return new Map();
    const residents = await DataSources.instance
      .getRepository(ResidentProfileEntity)
      .find({ where: { churchId, id: In(ids) }, withDeleted: true });
    const members = await DataSources.instance
      .getRepository(MemberEntity)
      .find({ where: { churchId, id: In(residents.map(resident => resident.memberId)) }, withDeleted: true });
    const memberName = new Map(members.map(member => [member.id, member.name]));
    return new Map(residents.map(resident => [resident.id, memberName.get(resident.memberId) ?? '(이름 없음)']));
  }

  private async assertResident(churchId: number, residentId: number): Promise<void> {
    const resident = await DataSources.instance.getRepository(ResidentProfileEntity).findOne({ where: { id: residentId, churchId } });
    if (!resident) throw new NotFoundException('간사를 찾을 수 없습니다.');
  }
}
