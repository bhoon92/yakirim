import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MinistryEntity } from '@src/database/entities/ministry.entity';
import { MissionaryNoteEntity } from '@src/database/entities/missionary-note.entity';
import { MissionaryProfileEntity } from '@src/database/entities/missionary-profile.entity';
import { MissionaryStageEntity } from '@src/database/entities/missionary-stage.entity';
import { AccountEntity } from '@src/database/entities/account.entity';
import { MemberStatusHistoryService } from '@src/module/member/member-status-history.service';
import { todayString } from '@src/common/date';
import { CreateMissionaryDto, CreateNoteDto, ListMissionaryQueryDto, UpdateMissionaryDto } from './dto/missionary.dto';

export type MissionaryItem = {
  id: number;
  memberId: number;
  memberName: string;
  stageId: number | null;
  stageName: string | null;
  /** 이 단계가 '현재 파송 중'으로 집계되는지 (대시보드·출석 명단 제외와 같은 기준). */
  stageCountsAsActive: boolean;
  country: string | null;
  region: string | null;
  fieldWork: string | null;
  ministryId: number | null;
  ministryName: string | null;
  commissionedAt: string | null;
  departedAt: string | null;
  endedAt: string | null;
  note: string | null;
};

export type MissionaryNoteItem = {
  id: number;
  content: string;
  stageId: number | null;
  stageName: string | null;
  date: string;
  recorderName: string | null;
  createdAt: Date;
};

/** 파송 현황 요약 — 단계별 인원은 교회가 정의한 단계를 그대로 따른다. */
export type MissionarySummary = {
  active: number;
  commissionedThisYear: number;
  byStage: { stageId: number | null; name: string; count: number; countsAsActive: boolean }[];
};

/** 재적상태 systemKey — 파송 집계 단계 진입/이탈에 따라 자동 전환되는 값. */
const STATUS_KEY_COMMISSIONED = 'commissioned';
const STATUS_KEY_WORKER = 'worker';

@Injectable()
export class MissionaryService {
  constructor(private readonly statusHistory: MemberStatusHistoryService) {}

  private repo() {
    return DataSources.instance.getRepository(MissionaryProfileEntity);
  }

  private noteRepo() {
    return DataSources.instance.getRepository(MissionaryNoteEntity);
  }

  private stageRepo() {
    return DataSources.instance.getRepository(MissionaryStageEntity);
  }

  async list(churchId: number, query: ListMissionaryQueryDto): Promise<MissionaryItem[]> {
    const stages = await this.stageRepo().find({ where: { churchId } });

    let where: Record<string, unknown> = { churchId };
    if (query.stageId) {
      where = { churchId, stageId: query.stageId };
    } else if (query.scope === 'active') {
      const activeIds = stages.filter(stage => stage.countsAsActive).map(stage => stage.id);
      if (activeIds.length === 0) return [];
      where = { churchId, stageId: In(activeIds) };
    }

    const profiles = await this.repo().find({ where, order: { id: 'ASC' } });
    return this.enrich(churchId, profiles, stages);
  }

  async findByMember(churchId: number, memberId: number): Promise<MissionaryItem | null> {
    const profile = await this.repo().findOne({ where: { churchId, memberId } });
    if (!profile) return null;
    return (await this.enrich(churchId, [profile]))[0];
  }

  async detail(churchId: number, id: number): Promise<MissionaryItem & { notes: MissionaryNoteItem[] }> {
    const profile = await this.assertProfile(churchId, id);
    const [item] = await this.enrich(churchId, [profile]);
    return { ...item, notes: await this.listNotes(churchId, id) };
  }

  /**
   * 파송 트랙 등록 — 교인 1명당 프로필 1개.
   * 명부에 없는 사람이면 `newMember` 로 교인을 함께 만든다 (교인 화면을 먼저 다녀오지 않아도 되게).
   */
  async create(churchId: number, accountId: number, dto: CreateMissionaryDto): Promise<MissionaryProfileEntity> {
    if (!dto.memberId && !dto.newMember) {
      throw new BadRequestException('기존 교인(memberId) 또는 신규 교인 정보(newMember) 중 하나가 필요합니다.');
    }
    if (dto.memberId && dto.newMember) {
      throw new BadRequestException('memberId 와 newMember 는 함께 보낼 수 없습니다.');
    }
    if (dto.stageId) await this.assertStage(churchId, dto.stageId);

    return DataSources.instance.transaction(async manager => {
      const memberId = dto.memberId ?? (await this.createMember(manager, churchId, dto.newMember!));

      if (dto.memberId) {
        const member = await manager.getRepository(MemberEntity).findOne({ where: { id: dto.memberId, churchId } });
        if (!member) throw new NotFoundException('교인을 찾을 수 없습니다.');
        const existing = await manager.getRepository(MissionaryProfileEntity).findOne({ where: { churchId, memberId } });
        if (existing) throw new ConflictException('이미 파송 트랙에 등록된 교인입니다.');
      }

      const stage = dto.stageId
        ? await manager.getRepository(MissionaryStageEntity).findOne({ where: { id: dto.stageId, churchId } })
        : null;
      const commissionedAt = dto.commissionedAt ?? (stage?.countsAsActive ? this.today() : undefined);

      const profile = await manager.getRepository(MissionaryProfileEntity).save(
        manager.getRepository(MissionaryProfileEntity).create({
          churchId,
          memberId,
          stageId: dto.stageId ?? null,
          country: dto.country,
          region: dto.region,
          fieldWork: dto.fieldWork,
          ministryId: dto.ministryId,
          commissionedAt,
          departedAt: dto.departedAt,
          endedAt: dto.endedAt,
          note: dto.note,
        })
      );

      if (stage?.countsAsActive) {
        await this.syncMemberStatus(manager, churchId, memberId, true);
      }
      return profile;
    });
  }

  /**
   * 프로필 수정. 현재 단계(stageId)도 여기서 바꿀 수 있다 — 기록을 남기지 않는 단순 정정용.
   * 기록과 함께 단계를 옮기려면 addNote 를 쓴다.
   */
  async update(churchId: number, id: number, dto: UpdateMissionaryDto): Promise<MissionaryProfileEntity> {
    const profile = await this.assertProfile(churchId, id);
    if (dto.stageId) await this.assertStage(churchId, dto.stageId);

    const editable = [
      'stageId',
      'country',
      'region',
      'fieldWork',
      'ministryId',
      'commissionedAt',
      'departedAt',
      'endedAt',
      'note',
    ] as const;
    const patch: Partial<MissionaryProfileEntity> = {};
    for (const key of editable) {
      if (dto[key] !== undefined) Object.assign(patch, { [key]: dto[key] });
    }

    await DataSources.instance.transaction(async manager => {
      await manager.getRepository(MissionaryProfileEntity).update({ id, churchId }, patch);
      if (dto.stageId !== undefined) {
        await this.applyStageSideEffects(manager, churchId, profile, dto.stageId, this.today());
      }
    });
    return this.assertProfile(churchId, id);
  }

  async remove(churchId: number, id: number): Promise<void> {
    await this.assertProfile(churchId, id);
    await DataSources.instance.transaction(async manager => {
      await manager.getRepository(MissionaryNoteEntity).softDelete({ churchId, missionaryId: id });
      await manager.getRepository(MissionaryProfileEntity).softDelete({ id, churchId });
    });
  }

  /**
   * 기록 추가. 메모가 본체이고 단계는 선택이다.
   * 단계를 지정하면 프로필의 현재 단계도 그 값으로 갱신되고, 파송 집계 단계에 처음 들어가면
   * 파송 확정일과 교인 재적상태가 함께 맞춰진다.
   */
  async addNote(churchId: number, id: number, accountId: number, dto: CreateNoteDto): Promise<MissionaryNoteEntity> {
    const profile = await this.assertProfile(churchId, id);
    if (dto.stageId) await this.assertStage(churchId, dto.stageId);
    const date = dto.date ?? this.today();

    return DataSources.instance.transaction(async manager => {
      const note = await manager.getRepository(MissionaryNoteEntity).save(
        manager.getRepository(MissionaryNoteEntity).create({
          churchId,
          missionaryId: id,
          content: dto.content,
          stageId: dto.stageId ?? null,
          date,
          recorderAccountId: accountId,
        })
      );

      if (dto.stageId) {
        await manager.getRepository(MissionaryProfileEntity).update({ id, churchId }, { stageId: dto.stageId });
        await this.applyStageSideEffects(manager, churchId, profile, dto.stageId, date);
      }
      return note;
    });
  }

  /** 기록 삭제 — 잘못 남긴 기록을 지울 수 있어야 한다. 프로필의 현재 단계는 건드리지 않는다. */
  async removeNote(churchId: number, missionaryId: number, noteId: number): Promise<void> {
    const note = await this.noteRepo().findOne({ where: { id: noteId, churchId, missionaryId } });
    if (!note) throw new NotFoundException('기록을 찾을 수 없습니다.');
    await this.noteRepo().softDelete({ id: noteId, churchId });
  }

  async listNotes(churchId: number, missionaryId: number): Promise<MissionaryNoteItem[]> {
    const notes = await this.noteRepo().find({
      where: { churchId, missionaryId },
      order: { date: 'DESC', id: 'DESC' },
    });
    if (notes.length === 0) return [];

    const accountIds = Array.from(new Set(notes.map(note => note.recorderAccountId)));
    const [stages, accounts] = await Promise.all([
      this.stageRepo().find({ where: { churchId } }),
      DataSources.instance.getRepository(AccountEntity).find({ where: { id: In(accountIds) } }),
    ]);
    const stageMap = new Map(stages.map(stage => [stage.id, stage.name]));
    const nameMap = new Map(accounts.map(account => [account.id, account.name]));

    return notes.map(note => ({
      id: note.id,
      content: note.content,
      stageId: note.stageId ?? null,
      stageName: note.stageId ? (stageMap.get(note.stageId) ?? null) : null,
      date: note.date,
      recorderName: nameMap.get(note.recorderAccountId) ?? null,
      createdAt: note.createdAt,
    }));
  }

  async summary(churchId: number): Promise<MissionarySummary> {
    const [profiles, stages] = await Promise.all([
      this.repo().find({ where: { churchId } }),
      this.stageRepo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } }),
    ]);
    const activeIds = new Set(stages.filter(stage => stage.countsAsActive).map(stage => stage.id));
    const year = new Date().getFullYear();

    const byStage: MissionarySummary['byStage'] = stages.map(stage => ({
      stageId: stage.id,
      name: stage.name,
      count: profiles.filter(profile => profile.stageId === stage.id).length,
      countsAsActive: stage.countsAsActive,
    }));
    const unassigned = profiles.filter(profile => !profile.stageId).length;
    if (unassigned > 0) byStage.push({ stageId: null, name: '단계 미지정', count: unassigned, countsAsActive: false });

    return {
      active: profiles.filter(profile => profile.stageId && activeIds.has(profile.stageId)).length,
      commissionedThisYear: profiles.filter(profile => profile.commissionedAt?.startsWith(`${year}-`)).length,
      byStage,
    };
  }

  /** 대시보드용 — 파송 집계 단계 id 목록. home.service 가 같은 기준을 쓰도록 공유. */
  async activeStageIds(churchId: number): Promise<number[]> {
    const stages = await this.stageRepo().find({ where: { churchId, countsAsActive: true } });
    return stages.map(stage => stage.id);
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
    await this.statusHistory.record(manager, churchId, member.id, status.id, { reason: '선교사 등록 시 함께 생성' });
    return member.id;
  }

  /**
   * 단계 전환의 부수효과 — 단계 **이름이 아니라 countsAsActive 플래그**로 판단한다.
   * 파송 집계 단계 진입: 파송 확정일 자동 기록 + 교인 재적상태 '파송'(출석 명단 제외)
   * 이탈: 재적상태 '사역자' 로 복귀
   */
  private async applyStageSideEffects(
    manager: EntityManager,
    churchId: number,
    profile: MissionaryProfileEntity,
    nextStageId: number | null,
    date: string
  ): Promise<void> {
    const stageRepo = manager.getRepository(MissionaryStageEntity);
    const [before, after] = await Promise.all([
      profile.stageId ? stageRepo.findOne({ where: { id: profile.stageId, churchId } }) : Promise.resolve(null),
      nextStageId ? stageRepo.findOne({ where: { id: nextStageId, churchId } }) : Promise.resolve(null),
    ]);
    const wasActive = before?.countsAsActive ?? false;
    const isActive = after?.countsAsActive ?? false;
    if (wasActive === isActive) return;

    if (isActive) {
      if (!profile.commissionedAt) {
        await manager.getRepository(MissionaryProfileEntity).update({ id: profile.id, churchId }, { commissionedAt: date });
      }
      await this.syncMemberStatus(manager, churchId, profile.memberId, true);
      return;
    }
    await this.syncMemberStatus(manager, churchId, profile.memberId, false);
  }

  /** 해당 systemKey 재적상태가 없으면 조용히 넘어간다 (교회가 상태를 지웠을 수 있다). */
  private async syncMemberStatus(manager: EntityManager, churchId: number, memberId: number, commissioned: boolean): Promise<void> {
    const systemKey = commissioned ? STATUS_KEY_COMMISSIONED : STATUS_KEY_WORKER;
    const status = await manager.getRepository(MemberStatusEntity).findOne({ where: { churchId, systemKey } });
    if (!status) return;
    await manager.getRepository(MemberEntity).update({ id: memberId, churchId }, { statusId: status.id });
    // 자동 전환도 이력에 남긴다. 사람이 바꾼 게 아니라는 걸 사유로 구분해 둔다.
    await this.statusHistory.record(manager, churchId, memberId, status.id, {
      reason: commissioned ? '파송 단계 진입 (자동)' : '파송 단계 이탈 (자동)',
    });
  }

  private async enrich(
    churchId: number,
    profiles: MissionaryProfileEntity[],
    preloadedStages?: MissionaryStageEntity[]
  ): Promise<MissionaryItem[]> {
    if (profiles.length === 0) return [];

    const [members, stages] = await Promise.all([
      DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(profiles.map(p => p.memberId)) } }),
      preloadedStages ? Promise.resolve(preloadedStages) : this.stageRepo().find({ where: { churchId } }),
    ]);
    const memberMap = new Map(members.map(member => [member.id, member.name]));
    const stageMap = new Map(stages.map(stage => [stage.id, stage]));

    const ministryIds = profiles.map(profile => profile.ministryId).filter((id): id is number => Boolean(id));
    const ministries =
      ministryIds.length > 0
        ? await DataSources.instance.getRepository(MinistryEntity).find({ where: { churchId, id: In(ministryIds) } })
        : [];
    const ministryMap = new Map(ministries.map(ministry => [ministry.id, ministry.name]));

    return profiles.map(profile => {
      const stage = profile.stageId ? stageMap.get(profile.stageId) : undefined;
      return {
        id: profile.id,
        memberId: profile.memberId,
        memberName: memberMap.get(profile.memberId) ?? '(삭제된 교인)',
        stageId: profile.stageId ?? null,
        stageName: stage?.name ?? null,
        stageCountsAsActive: stage?.countsAsActive ?? false,
        country: profile.country ?? null,
        region: profile.region ?? null,
        fieldWork: profile.fieldWork ?? null,
        ministryId: profile.ministryId ?? null,
        ministryName: profile.ministryId ? (ministryMap.get(profile.ministryId) ?? null) : null,
        commissionedAt: profile.commissionedAt ?? null,
        departedAt: profile.departedAt ?? null,
        endedAt: profile.endedAt ?? null,
        note: profile.note ?? null,
      };
    });
  }

  private async assertProfile(churchId: number, id: number): Promise<MissionaryProfileEntity> {
    const profile = await this.repo().findOne({ where: { id, churchId } });
    if (!profile) throw new NotFoundException('선교사 프로필을 찾을 수 없습니다.');
    return profile;
  }

  private async assertStage(churchId: number, stageId: number): Promise<void> {
    const stage = await this.stageRepo().findOne({ where: { id: stageId, churchId } });
    if (!stage) throw new NotFoundException('선교사 단계를 찾을 수 없습니다.');
  }

  private today(): string {
    // toISOString 은 UTC 라 TZ=Asia/Seoul 에서 새벽 0~9시에 어제로 찍힌다 → 파송 확정일이 하루 밀린다.
    return todayString();
  }
}
