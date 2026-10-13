import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { todayString } from '@src/common/date';
import { DataSources } from '@src/database/data-sources';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { ResidentProfileEntity } from '@src/database/entities/resident-profile.entity';
import { TrainingCohortEntity } from '@src/database/entities/training-cohort.entity';
import { TrainingCourseEntity } from '@src/database/entities/training-course.entity';
import { EnrollmentStatus, TrainingEnrollmentEntity } from '@src/database/entities/training-enrollment.entity';
import { MemberStatusHistoryService } from '@src/module/member/member-status-history.service';

export type PromotionCandidate = {
  memberId: number;
  memberName: string;
  statusId: number;
  statusName: string | null;
  /** 수료일 — 올릴 때 새 단계의 시작일로 쓴다. */
  completedAt: string | null;
};

/** 기수 하나의 "수료했으니 올릴까요?" 제안. 화면이 그대로 그린다. */
export type CohortPromotions = {
  /** 과정이 제안하는 재적상태. null 이면 이 과정은 단계 제안을 하지 않는다. */
  target: { id: number; name: string } | null;
  /** 수료했는데 아직 target 보다 아래 단계에 있는 사람. */
  candidates: PromotionCandidate[];
  /** 과정이 간사 등록을 제안하는지. */
  suggestsResident: boolean;
  /** 수료했는데 아직 간사가 아닌 사람. */
  residentCandidates: { memberId: number; memberName: string }[];
};

/**
 * 훈련 수료 → 파이프라인 단계 제안 (planning 00.7 C).
 *
 * **자동으로 바꾸지 않는다.** 수료를 자동 판정하지 않는 것과 같은 이유다 — 담당자가 보고 누른다.
 * 제안 대상은 매번 데이터에서 계산한다(따로 저장하지 않는다). 그래서 이미 올린 사람, 다른 경로로
 * 더 높은 단계에 간 사람은 저절로 빠진다.
 *
 * "아래 단계"는 재적상태 정렬순서로 판단한다. 장기결석·이명처럼 파이프라인 뒤에 놓인 상태는
 * 정렬순서가 커서 자연히 대상에서 빠진다.
 */
@Injectable()
export class TrainingPromotionService {
  constructor(private readonly statusHistory: MemberStatusHistoryService) {}

  async forCohort(churchId: number, cohortId: number): Promise<CohortPromotions> {
    const { course } = await this.load(churchId, cohortId);
    const completed = await DataSources.instance
      .getRepository(TrainingEnrollmentEntity)
      .find({ where: { churchId, cohortId, status: EnrollmentStatus.COMPLETED } });

    const memberIds = completed.map(row => row.memberId);
    const [members, statuses, residents] = await Promise.all([
      memberIds.length > 0 ? DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(memberIds) } }) : [],
      DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } }),
      course.completionSuggestsResident && memberIds.length > 0
        ? DataSources.instance.getRepository(ResidentProfileEntity).find({ where: { churchId, memberId: In(memberIds) } })
        : [],
    ]);
    const statusMap = new Map(statuses.map(status => [status.id, status]));
    const memberMap = new Map(members.map(member => [member.id, member]));
    const target = course.completionStatusId ? statusMap.get(course.completionStatusId) : undefined;

    const candidates: PromotionCandidate[] = [];
    if (target) {
      for (const row of completed) {
        const member = memberMap.get(row.memberId);
        const current = member ? statusMap.get(member.statusId) : undefined;
        if (!member || !current || current.sortOrder >= target.sortOrder) continue;
        candidates.push({
          memberId: member.id,
          memberName: member.name,
          statusId: current.id,
          statusName: current.name,
          completedAt: row.closedAt ?? null,
        });
      }
    }

    const residentIds = new Set(residents.map(resident => resident.memberId));
    const residentCandidates = course.completionSuggestsResident
      ? completed
          .filter(row => !residentIds.has(row.memberId) && memberMap.has(row.memberId))
          .map(row => ({ memberId: row.memberId, memberName: memberMap.get(row.memberId)!.name }))
      : [];

    return {
      target: target ? { id: target.id, name: target.name } : null,
      candidates,
      suggestsResident: course.completionSuggestsResident,
      residentCandidates,
    };
  }

  /**
   * 고른 사람들을 과정이 제안하는 단계로 올린다. 대상 여부는 서버가 다시 계산한다 —
   * 화면이 오래된 목록을 들고 있어도 이미 올라간 사람을 내리지 않는다.
   * 새 단계 시작일은 수료일(없으면 오늘), 사유는 "과정 기수 수료".
   */
  async apply(churchId: number, cohortId: number, memberIds: number[]): Promise<{ promoted: number; skipped: number }> {
    const { course, cohort } = await this.load(churchId, cohortId);
    if (!course.completionStatusId) throw new BadRequestException('이 과정은 수료 시 올릴 단계가 정해져 있지 않습니다.');

    const { candidates } = await this.forCohort(churchId, cohortId);
    const eligible = new Map(candidates.map(candidate => [candidate.memberId, candidate]));
    const targetId = course.completionStatusId;
    let promoted = 0;

    await DataSources.instance.transaction(async manager => {
      for (const memberId of memberIds) {
        const candidate = eligible.get(memberId);
        if (!candidate) continue;
        await manager.getRepository(MemberEntity).update({ id: memberId, churchId }, { statusId: targetId });
        await this.statusHistory.record(manager, churchId, memberId, targetId, {
          date: candidate.completedAt ?? todayString(),
          reason: `${course.name} ${cohort.name} 수료`,
        });
        promoted += 1;
      }
    });
    return { promoted, skipped: memberIds.length - promoted };
  }

  private async load(churchId: number, cohortId: number): Promise<{ cohort: TrainingCohortEntity; course: TrainingCourseEntity }> {
    const cohort = await DataSources.instance.getRepository(TrainingCohortEntity).findOne({ where: { id: cohortId, churchId } });
    if (!cohort) throw new NotFoundException('기수를 찾을 수 없습니다.');
    // 숨기거나 지운 과정의 기수도 제안은 계산할 수 있어야 한다
    const course = await DataSources.instance
      .getRepository(TrainingCourseEntity)
      .findOne({ where: { id: cohort.courseId, churchId }, withDeleted: true });
    if (!course) throw new NotFoundException('훈련 과정을 찾을 수 없습니다.');
    return { cohort, course };
  }
}
