import { Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { daysBetween, toDateString, todayString } from '@src/common/date';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { AffiliationService, type AffiliationTagSet } from '@src/module/affiliation/affiliation.service';
import { MemberPositionService } from '@src/module/position/member-position.service';
import { ShepherdService, type ShepherdTag } from '@src/module/shepherd/shepherd.service';
import { MemberStatusHistoryService, STALLED_CONDITION, stalledParams } from './member-status-history.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { ListMemberQueryDto } from './dto/list-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

export type MemberStatusCount = { id: number; name: string; count: number };
export type MemberListCounts = { all: number; byStatus: MemberStatusCount[] };
/** 목록 한 행 — 상세에서 넣은 역할·소속이 목록에서도 보이도록 함께 내린다. */
export type MemberView = MemberEntity &
  AffiliationTagSet & {
    statusName: string | null;
    /** 현재 사역 역할. 없으면 null */
    position: { id: number; name: string | null } | null;
    /** 지금 담당 간사. 없으면 null */
    shepherd: ShepherdTag | null;
  };

/** 파이프라인 보드의 카드 한 장. */
export type PipelineCard = {
  id: number;
  name: string;
  /** 지금 단계에 들어온 날 (이력이 없으면 null) */
  since: string | null;
  days: number | null;
  /** 정체 — 이 단계의 기준일수를 넘김. 판정은 STALLED_CONDITION 과 같다(테스트가 대조). */
  stalled: boolean;
  shepherdName: string | null;
};

/** 파이프라인 보드의 칸 하나 = 재적상태 하나. */
export type PipelineColumn = {
  statusId: number;
  name: string;
  stallsAfterDays: number | null;
  count: number;
  stalledCount: number;
  /** 오래 머문 순으로 최대 PIPELINE_CARDS_PER_COLUMN 장. 나머지는 count 로만 알린다. */
  members: PipelineCard[];
};

export const PIPELINE_CARDS_PER_COLUMN = 50;

@Injectable()
export class MemberService {
  constructor(
    private readonly affiliations: AffiliationService,
    private readonly positions: MemberPositionService,
    private readonly statusHistory: MemberStatusHistoryService,
    private readonly shepherds: ShepherdService
  ) {}

  private repo() {
    return DataSources.instance.getRepository(MemberEntity);
  }

  private statusRepo() {
    return DataSources.instance.getRepository(MemberStatusEntity);
  }

  async create(churchId: number, dto: CreateMemberDto): Promise<MemberEntity> {
    const statusId = dto.statusId ?? (await this.defaultStatusId(churchId));
    return DataSources.instance.transaction(async manager => {
      const repo = manager.getRepository(MemberEntity);
      const member = await repo.save(repo.create({ ...dto, statusId, churchId }));
      // 첫 구간도 이력이다 — 없으면 "언제 방문으로 들어왔나"를 나중에 알 수 없다.
      await this.statusHistory.record(manager, churchId, member.id, statusId, { date: dto.registeredAt });
      return member;
    });
  }

  async list(
    churchId: number,
    query: ListMemberQueryDto
  ): Promise<{ items: MemberView[]; total: number; page: number; pageSize: number; counts: MemberListCounts }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const affiliationMemberIds = await this.resolveAffiliationMemberIds(churchId, query);

    const qb = this.repo().createQueryBuilder('m').where('m.churchId = :churchId', { churchId });
    this.applySearchFilters(qb, query.q, affiliationMemberIds);

    if (query.statusId) {
      qb.andWhere('m.statusId = :statusId', { statusId: query.statusId });
    }

    // 정체 필터 — 대시보드 카드의 인원을 실제로 훑을 수 있어야 한다. 판정은 listStalled 와 같은 STALLED_CONDITION.
    if (query.stalled) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM member_status_history h
           JOIN member_status s ON s.id = h.status_id
           WHERE h.member_id = m.id
             AND h.church_id = m.church_id
             AND h.deleted_at IS NULL
             AND ${STALLED_CONDITION}
         )`,
        stalledParams()
      );
    }

    // 담당 간사 필터 — "이 간사가 맡은 사람" / "아직 담당이 없는 사람"
    const openShepherd = `SELECT 1 FROM member_shepherd sh
       WHERE sh.member_id = m.id AND sh.church_id = m.church_id AND sh.end_date IS NULL AND sh.deleted_at IS NULL`;
    if (query.shepherdResidentId) {
      qb.andWhere(`EXISTS (${openShepherd} AND sh.resident_id = :shepherdResidentId)`, { shepherdResidentId: query.shepherdResidentId });
    } else if (query.noShepherd) {
      qb.andWhere(`NOT EXISTS (${openShepherd})`);
    }

    qb.orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const memberIds = items.map(member => member.id);

    // 역할·소속은 성도별로 부르면 20행에 60번 질의가 나간다 → 배치 조회로 한 번씩만.
    const [statusMap, positionByMember, affiliationsByMember, shepherdByMember] = await Promise.all([
      this.statusMap(churchId),
      this.positions.currentForMembers(churchId, memberIds),
      this.affiliations.currentForMembers(churchId, memberIds),
      this.shepherds.currentForMembers(churchId, memberIds),
    ]);

    const view: MemberView[] = items.map(member => ({
      ...member,
      statusName: statusMap.get(member.statusId)?.name ?? null,
      position: positionByMember.get(member.id) ?? null,
      shepherd: shepherdByMember.get(member.id) ?? null,
      ...(affiliationsByMember.get(member.id) ?? { departments: [], ministries: [], smallGroups: [] }),
    }));
    const counts = await this.countByStatus(churchId, query.q, affiliationMemberIds, statusMap);

    return { items: view, total, page, pageSize, counts };
  }

  /** 소속(부서/사역팀/목장) 필터가 있으면 해당 활성 소속 성도 id 목록, 없으면 null. */
  private async resolveAffiliationMemberIds(churchId: number, query: ListMemberQueryDto): Promise<number[] | null> {
    if (!query.affiliationKind || !query.affiliationId) return null;
    return this.affiliations.memberIdsFor(query.affiliationKind, churchId, query.affiliationId);
  }

  /** 이름·전화 부분일치 + 소속 성도 id 필터를 쿼리에 적용 (list/countByStatus 공용). */
  private applySearchFilters(qb: SelectQueryBuilder<MemberEntity>, q?: string, affiliationMemberIds?: number[] | null): void {
    if (q) {
      qb.andWhere(
        new Brackets(builder => {
          builder.where('m.name ILIKE :q', { q: `%${q}%` }).orWhere('m.phone ILIKE :q', { q: `%${q}%` });
        })
      );
    }
    if (affiliationMemberIds) {
      if (affiliationMemberIds.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('m.id IN (:...affiliationMemberIds)', { affiliationMemberIds });
    }
  }

  /** 엑셀 내보내기용 — 전체 재적 (이름 오름차순). */
  listAll(churchId: number): Promise<MemberEntity[]> {
    return this.repo().find({ where: { churchId }, order: { name: 'ASC', id: 'ASC' } });
  }

  async findById(churchId: number, id: number) {
    const member = await this.repo().findOne({ where: { id, churchId } });
    if (!member) throw new NotFoundException('Member not found');
    const [affiliations, position, statusMap] = await Promise.all([
      this.affiliations.listForMember(churchId, id),
      this.positions.history(churchId, id),
      this.statusMap(churchId),
    ]);
    return { ...member, statusName: statusMap.get(member.statusId)?.name ?? null, affiliations, position };
  }

  async update(churchId: number, id: number, dto: UpdateMemberDto) {
    const before = await this.repo().findOne({ where: { id, churchId } });
    if (!before) throw new NotFoundException('Member not found');

    await DataSources.instance.transaction(async manager => {
      await manager.getRepository(MemberEntity).update({ id, churchId }, dto);
      if (dto.statusId !== undefined && dto.statusId !== before.statusId) {
        await this.statusHistory.record(manager, churchId, id, dto.statusId);
      }
    });
    return this.findById(churchId, id);
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('Member not found');
  }

  /** 교회 재적상태 map (id → 상태). */
  /**
   * 노션 보드처럼 재적상태별 칸에 교인 카드를 놓는다. 숨긴(비활성) 상태는 사람이 남아 있을 때만 칸을 보인다.
   * 단계 이동은 따로 만들지 않는다 — 교인 수정(statusId)이 이미 이력(record)을 남긴다.
   */
  async pipelineBoard(churchId: number): Promise<PipelineColumn[]> {
    const [statuses, rows] = await Promise.all([
      this.statusRepo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } }),
      DataSources.instance.query(
        `SELECT m.id, m.name, m.status_id AS "statusId", h.start_date AS "since"
           FROM member m
           LEFT JOIN member_status_history h
             ON h.member_id = m.id AND h.church_id = m.church_id AND h.end_date IS NULL AND h.deleted_at IS NULL
          WHERE m.church_id = $1 AND m.deleted_at IS NULL`,
        [churchId]
      ) as Promise<{ id: number; name: string; statusId: number; since: string | Date | null }[]>,
    ]);
    const today = todayString();
    const shepherds = await this.shepherds.currentForMembers(
      churchId,
      rows.map(row => row.id)
    );

    return statuses
      .map(status => {
        const cards: PipelineCard[] = rows
          .filter(row => row.statusId === status.id)
          .map(row => {
            const since = row.since ? toDateString(row.since) : null;
            const days = since ? daysBetween(since, today) : null;
            return {
              id: row.id,
              name: row.name,
              since,
              days,
              stalled: status.stallsAfterDays != null && days != null && days >= status.stallsAfterDays,
              shepherdName: shepherds.get(row.id)?.name ?? null,
            };
          })
          .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || a.name.localeCompare(b.name, 'ko'));
        const column: PipelineColumn = {
          statusId: status.id,
          name: status.name,
          stallsAfterDays: status.stallsAfterDays ?? null,
          count: cards.length,
          stalledCount: cards.filter(card => card.stalled).length,
          members: cards.slice(0, PIPELINE_CARDS_PER_COLUMN),
        };
        return { column, visible: status.isActive || cards.length > 0 };
      })
      .filter(entry => entry.visible)
      .map(entry => entry.column);
  }

  private async statusMap(churchId: number): Promise<Map<number, MemberStatusEntity>> {
    const statuses = await this.statusRepo().find({ where: { churchId } });
    return new Map(statuses.map(status => [status.id, status]));
  }

  /** 신규 성도 기본 상태 = 활성 상태 중 sortOrder 최소(보통 '방문'). */
  private async defaultStatusId(churchId: number): Promise<number> {
    const status = await this.statusRepo().findOne({
      where: { churchId, isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (!status) throw new NotFoundException('재적상태가 설정되지 않았습니다.');
    return status.id;
  }

  /** UI filter chip 카운트 — 활성 상태별(0 포함) + 전체. */
  private async countByStatus(
    churchId: number,
    q: string | undefined,
    affiliationMemberIds: number[] | null | undefined,
    statusMap: Map<number, MemberStatusEntity>
  ): Promise<MemberListCounts> {
    const qb = this.repo()
      .createQueryBuilder('m')
      .select('m.statusId', 'statusId')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.churchId = :churchId', { churchId });

    this.applySearchFilters(qb, q, affiliationMemberIds);
    qb.groupBy('m.statusId');

    const rows = (await qb.getRawMany()) as { statusId: number; cnt: string }[];
    const countById = new Map(rows.map(row => [Number(row.statusId), Number(row.cnt)]));
    const all = rows.reduce((sum, row) => sum + Number(row.cnt), 0);

    const byStatus = Array.from(statusMap.values())
      .filter(status => status.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map(status => ({ id: status.id, name: status.name, count: countById.get(status.id) ?? 0 }));

    return { all, byStatus };
  }
}
