import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { AccountEntity } from '@src/database/entities/account.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { ResidentDutyAssignmentEntity } from '@src/database/entities/resident-duty-assignment.entity';
import { ResidentProfileEntity } from '@src/database/entities/resident-profile.entity';
import { ResidentStatusHistoryEntity } from '@src/database/entities/resident-status-history.entity';
import { ResidentStatusEntity } from '@src/database/entities/resident-status.entity';
import { TrainingCohortEntity } from '@src/database/entities/training-cohort.entity';
import { EnrollmentStatus, TrainingEnrollmentEntity } from '@src/database/entities/training-enrollment.entity';
import { todayString } from '@src/common/date';
import { AffiliationService, type AffiliationTag } from '@src/module/affiliation/affiliation.service';
import { MemberStatusHistoryService } from '@src/module/member/member-status-history.service';
import { MemberPositionService } from '@src/module/position/member-position.service';
import { ResidentDutyService, type ResidentDutyTag } from './resident-duty.service';
import { CreateResidentDto, ListResidentQueryDto, UpdateResidentDto } from './dto/resident.dto';

/** 과정별로 이 사람이 어디까지 왔는지. 같은 과정을 여러 번 들었으면 수료 > 수강 중 > 중도 순으로 대표값을 고른다. */
export type ResidentTrainingStep = { courseId: number; status: EnrollmentStatus };

export type ResidentItem = {
  id: number;
  memberId: number;
  memberName: string;
  phone: string | null;
  statusId: number | null;
  statusName: string | null;
  /** 이 상태가 '지금 공동체에 있는 간사'로 집계되는지. */
  statusCountsAsActive: boolean;
  joinedAt: string | null;
  committedAt: string | null;
  leftAt: string | null;
  note: string | null;
  /** 아래 셋은 교인의 현재 소속·사역 역할을 그대로 읽은 것 — 편집도 교인 쪽에서 한다. */
  smallGroups: AffiliationTag[];
  ministries: AffiliationTag[];
  position: { id: number; name: string | null } | null;
  /** 맡은 사역 — 노션 다중 선택처럼 간사 화면에서 바로 붙이고 뗀다. */
  duties: ResidentDutyTag[];
  training: ResidentTrainingStep[];
};

export type ResidentHistoryItem = {
  id: number;
  statusId: number;
  statusName: string | null;
  date: string;
  reason: string | null;
  recorderName: string | null;
};

export type ResidentSummary = {
  active: number;
  byStatus: { statusId: number | null; name: string; count: number; countsAsActive: boolean }[];
};

const STEP_RANK: Record<EnrollmentStatus, number> = {
  [EnrollmentStatus.COMPLETED]: 2,
  [EnrollmentStatus.ENROLLED]: 1,
  [EnrollmentStatus.DROPPED]: 0,
};

@Injectable()
export class ResidentService {
  constructor(
    private readonly statusHistory: MemberStatusHistoryService,
    private readonly affiliations: AffiliationService,
    private readonly positions: MemberPositionService,
    private readonly duties: ResidentDutyService
  ) {}

  private repo() {
    return DataSources.instance.getRepository(ResidentProfileEntity);
  }

  private historyRepo() {
    return DataSources.instance.getRepository(ResidentStatusHistoryEntity);
  }

  private statusRepo() {
    return DataSources.instance.getRepository(ResidentStatusEntity);
  }

  async list(churchId: number, query: ListResidentQueryDto): Promise<ResidentItem[]> {
    const statuses = await this.statusRepo().find({ where: { churchId } });

    let where: Record<string, unknown> = { churchId };
    if (query.statusId) {
      where = { churchId, statusId: query.statusId };
    } else if (query.scope === 'active') {
      const activeIds = statuses.filter(status => status.countsAsActive).map(status => status.id);
      if (activeIds.length === 0) return [];
      where = { churchId, statusId: In(activeIds) };
    }

    const profiles = await this.repo().find({ where, order: { joinedAt: 'ASC', id: 'ASC' } });
    const items = await this.enrich(churchId, profiles, statuses);
    return items.sort((a, b) => a.memberName.localeCompare(b.memberName, 'ko'));
  }

  async summary(churchId: number): Promise<ResidentSummary> {
    const [profiles, statuses] = await Promise.all([
      this.repo().find({ where: { churchId } }),
      this.statusRepo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } }),
    ]);
    const activeIds = new Set(statuses.filter(status => status.countsAsActive).map(status => status.id));

    const byStatus: ResidentSummary['byStatus'] = statuses.map(status => ({
      statusId: status.id,
      name: status.name,
      count: profiles.filter(profile => profile.statusId === status.id).length,
      countsAsActive: status.countsAsActive,
    }));
    const unassigned = profiles.filter(profile => !profile.statusId).length;
    if (unassigned > 0) byStatus.push({ statusId: null, name: '상태 미지정', count: unassigned, countsAsActive: false });

    return {
      active: profiles.filter(profile => profile.statusId && activeIds.has(profile.statusId)).length,
      byStatus,
    };
  }

  async findByMember(churchId: number, memberId: number): Promise<ResidentItem | null> {
    const profile = await this.repo().findOne({ where: { churchId, memberId } });
    if (!profile) return null;
    return (await this.enrich(churchId, [profile]))[0];
  }

  async detail(churchId: number, id: number): Promise<ResidentItem & { history: ResidentHistoryItem[] }> {
    const profile = await this.assertProfile(churchId, id);
    const [item] = await this.enrich(churchId, [profile]);
    return { ...item, history: await this.listHistory(churchId, id) };
  }

  /**
   * 간사 등록 — 교인 1명당 프로필 1개.
   * 명부에 없는 사람이면 `newMember` 로 교인을 함께 만든다 (선교사 등록과 같은 흐름).
   */
  async create(churchId: number, accountId: number, dto: CreateResidentDto): Promise<ResidentProfileEntity> {
    if (!dto.memberId && !dto.newMember) {
      throw new BadRequestException('기존 교인(memberId) 또는 신규 교인 정보(newMember) 중 하나가 필요합니다.');
    }
    if (dto.memberId && dto.newMember) {
      throw new BadRequestException('memberId 와 newMember 는 함께 보낼 수 없습니다.');
    }
    if (dto.statusId) await this.assertStatus(churchId, dto.statusId);

    return DataSources.instance.transaction(async manager => {
      const memberId = dto.memberId ?? (await this.createMember(manager, churchId, dto.newMember!));

      if (dto.memberId) {
        const member = await manager.getRepository(MemberEntity).findOne({ where: { id: dto.memberId, churchId } });
        if (!member) throw new NotFoundException('교인을 찾을 수 없습니다.');
        const existing = await manager.getRepository(ResidentProfileEntity).findOne({ where: { churchId, memberId } });
        if (existing) throw new ConflictException('이미 간사로 등록된 교인입니다.');
      }

      const profile = await manager.getRepository(ResidentProfileEntity).save(
        manager.getRepository(ResidentProfileEntity).create({
          churchId,
          memberId,
          statusId: dto.statusId ?? null,
          joinedAt: dto.joinedAt ?? null,
          committedAt: dto.committedAt ?? null,
          leftAt: dto.leftAt ?? null,
          note: dto.note ?? null,
        })
      );

      if (dto.statusId) {
        await this.recordHistory(manager, churchId, profile.id, accountId, dto.statusId, dto.joinedAt ?? todayString(), '간사 등록');
      }
      return profile;
    });
  }

  /**
   * 프로필 수정. 상태(`statusId`)가 바뀌면 이력이 한 줄 쌓인다 — `statusReason`·`statusDate` 를 함께 보낼 수 있다.
   * 공동체 집계 상태에서 벗어나는데 퇴소일이 비어 있으면 변경일로 채운다.
   */
  async update(churchId: number, id: number, accountId: number, dto: UpdateResidentDto): Promise<ResidentProfileEntity> {
    const profile = await this.assertProfile(churchId, id);
    if (dto.statusId) await this.assertStatus(churchId, dto.statusId);

    const editable = ['statusId', 'joinedAt', 'committedAt', 'leftAt', 'note'] as const;
    const patch: Partial<ResidentProfileEntity> = {};
    for (const key of editable) {
      if (dto[key] !== undefined) Object.assign(patch, { [key]: dto[key] });
    }

    const statusChanged = dto.statusId !== undefined && dto.statusId !== profile.statusId;
    const date = dto.statusDate ?? todayString();

    await DataSources.instance.transaction(async manager => {
      if (statusChanged && dto.statusId) {
        const statusRepo = manager.getRepository(ResidentStatusEntity);
        const [before, after] = await Promise.all([
          profile.statusId ? statusRepo.findOne({ where: { id: profile.statusId, churchId } }) : Promise.resolve(null),
          statusRepo.findOne({ where: { id: dto.statusId, churchId } }),
        ]);
        const leaving = (before?.countsAsActive ?? false) && !(after?.countsAsActive ?? false);
        if (leaving && !profile.leftAt && dto.leftAt === undefined) patch.leftAt = date;

        await this.recordHistory(manager, churchId, id, accountId, dto.statusId, date, dto.statusReason ?? null);
      }
      if (Object.keys(patch).length > 0) {
        await manager.getRepository(ResidentProfileEntity).update({ id, churchId }, patch);
      }
    });
    return this.assertProfile(churchId, id);
  }

  async remove(churchId: number, id: number): Promise<void> {
    await this.assertProfile(churchId, id);
    await DataSources.instance.transaction(async manager => {
      await manager.getRepository(ResidentStatusHistoryEntity).softDelete({ churchId, residentId: id });
      await manager.getRepository(ResidentDutyAssignmentEntity).softDelete({ churchId, residentId: id });
      await manager.getRepository(ResidentProfileEntity).softDelete({ id, churchId });
    });
  }

  async listHistory(churchId: number, residentId: number): Promise<ResidentHistoryItem[]> {
    const rows = await this.historyRepo().find({ where: { churchId, residentId }, order: { date: 'DESC', id: 'DESC' } });
    if (rows.length === 0) return [];

    const [statuses, accounts] = await Promise.all([
      this.statusRepo().find({ where: { churchId } }),
      DataSources.instance
        .getRepository(AccountEntity)
        .find({ where: { id: In(Array.from(new Set(rows.map(row => row.recorderAccountId)))) } }),
    ]);
    const statusMap = new Map(statuses.map(status => [status.id, status.name]));
    const nameMap = new Map(accounts.map(account => [account.id, account.name]));

    return rows.map(row => ({
      id: row.id,
      statusId: row.statusId,
      statusName: statusMap.get(row.statusId) ?? null,
      date: row.date,
      reason: row.reason ?? null,
      recorderName: nameMap.get(row.recorderAccountId) ?? null,
    }));
  }

  /** 잘못 남긴 이력을 지운다. 프로필의 현재 상태는 바뀌지 않는다 (선교사 기록 삭제와 같은 규칙). */
  async removeHistory(churchId: number, residentId: number, historyId: number): Promise<void> {
    const row = await this.historyRepo().findOne({ where: { id: historyId, churchId, residentId } });
    if (!row) throw new NotFoundException('이력을 찾을 수 없습니다.');
    await this.historyRepo().softDelete({ id: historyId, churchId });
  }

  private async recordHistory(
    manager: EntityManager,
    churchId: number,
    residentId: number,
    accountId: number,
    statusId: number,
    date: string,
    reason: string | null
  ): Promise<void> {
    const repo = manager.getRepository(ResidentStatusHistoryEntity);
    await repo.save(repo.create({ churchId, residentId, statusId, date, reason, recorderAccountId: accountId }));
  }

  private async createMember(manager: EntityManager, churchId: number, newMember: { name: string; phone?: string }): Promise<number> {
    const status = await manager.getRepository(MemberStatusEntity).findOne({
      where: { churchId, isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (!status) throw new NotFoundException('재적상태가 설정되지 않았습니다.');

    const member = await manager
      .getRepository(MemberEntity)
      .save(manager.getRepository(MemberEntity).create({ churchId, name: newMember.name, phone: newMember.phone, statusId: status.id }));
    await this.statusHistory.record(manager, churchId, member.id, status.id, { reason: '간사 등록 시 함께 생성' });
    return member.id;
  }

  /** 목록 한 번에 질의 몇 개로 끝낸다 — 간사 50명에 사람마다 소속·역할·훈련을 따로 읽으면 수백 번이 된다. */
  private async enrich(
    churchId: number,
    profiles: ResidentProfileEntity[],
    preloadedStatuses?: ResidentStatusEntity[]
  ): Promise<ResidentItem[]> {
    if (profiles.length === 0) return [];
    const memberIds = profiles.map(profile => profile.memberId);

    const [members, statuses, affiliations, positions, training, duties] = await Promise.all([
      DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(memberIds) } }),
      preloadedStatuses ? Promise.resolve(preloadedStatuses) : this.statusRepo().find({ where: { churchId } }),
      this.affiliations.currentForMembers(churchId, memberIds),
      this.positions.currentForMembers(churchId, memberIds),
      this.trainingSteps(churchId, memberIds),
      this.duties.currentForResidents(
        churchId,
        profiles.map(profile => profile.id)
      ),
    ]);
    const memberMap = new Map(members.map(member => [member.id, member]));
    const statusMap = new Map(statuses.map(status => [status.id, status]));

    return profiles.map(profile => {
      const member = memberMap.get(profile.memberId);
      const status = profile.statusId ? statusMap.get(profile.statusId) : undefined;
      const tags = affiliations.get(profile.memberId);
      return {
        id: profile.id,
        memberId: profile.memberId,
        memberName: member?.name ?? '(삭제된 교인)',
        phone: member?.phone ?? null,
        statusId: profile.statusId ?? null,
        statusName: status?.name ?? null,
        statusCountsAsActive: status?.countsAsActive ?? false,
        joinedAt: profile.joinedAt ?? null,
        committedAt: profile.committedAt ?? null,
        leftAt: profile.leftAt ?? null,
        note: profile.note ?? null,
        smallGroups: tags?.smallGroups ?? [],
        ministries: tags?.ministries ?? [],
        position: positions.get(profile.memberId) ?? null,
        duties: duties.get(profile.id) ?? [],
        training: training.get(profile.memberId) ?? [],
      };
    });
  }

  private async trainingSteps(churchId: number, memberIds: number[]): Promise<Map<number, ResidentTrainingStep[]>> {
    const result = new Map<number, ResidentTrainingStep[]>();
    const enrollments = await DataSources.instance
      .getRepository(TrainingEnrollmentEntity)
      .find({ where: { churchId, memberId: In(memberIds) } });
    if (enrollments.length === 0) return result;

    const cohorts = await DataSources.instance
      .getRepository(TrainingCohortEntity)
      .find({ where: { churchId, id: In(Array.from(new Set(enrollments.map(row => row.cohortId)))) } });
    const courseByCohort = new Map(cohorts.map(cohort => [cohort.id, cohort.courseId]));

    const best = new Map<number, Map<number, EnrollmentStatus>>();
    for (const enrollment of enrollments) {
      const courseId = courseByCohort.get(enrollment.cohortId);
      if (!courseId) continue;
      const perMember = best.get(enrollment.memberId) ?? new Map<number, EnrollmentStatus>();
      const current = perMember.get(courseId);
      if (!current || STEP_RANK[enrollment.status] > STEP_RANK[current]) perMember.set(courseId, enrollment.status);
      best.set(enrollment.memberId, perMember);
    }
    for (const [memberId, perMember] of best) {
      result.set(
        memberId,
        Array.from(perMember, ([courseId, status]) => ({ courseId, status }))
      );
    }
    return result;
  }

  private async assertProfile(churchId: number, id: number): Promise<ResidentProfileEntity> {
    const profile = await this.repo().findOne({ where: { id, churchId } });
    if (!profile) throw new NotFoundException('간사 프로필을 찾을 수 없습니다.');
    return profile;
  }

  private async assertStatus(churchId: number, statusId: number): Promise<void> {
    const status = await this.statusRepo().findOne({ where: { id: statusId, churchId } });
    if (!status) throw new NotFoundException('간사 상태를 찾을 수 없습니다.');
  }
}
