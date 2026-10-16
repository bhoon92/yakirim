import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In, IsNull, Not } from 'typeorm';
import { todayString } from '@src/common/date';
import { DataSources } from '@src/database/data-sources';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
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
};

/** 놓친 제안 — 제안이 남아 있는 기수만. 대시보드·훈련 화면이 모아 보여준다. */
export type PendingPromotion = CohortPromotions & { cohortId: number; label: string };

/** 다음 STEP 후보 — 이전 STEP 을 수료했는데 이 과정은 아직 안 들은 사람. */
export type NextStepCandidates = {
  /** 이전 단계 번호. null 이면 이 과정은 사다리 첫 단계이거나 사다리 밖이라 후보가 없다. */
  previousStep: number | null;
  candidates: { memberId: number; memberName: string; completedLabel: string; completedAt: string | null }[];
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
      .find({ where: { churchId, cohortId, status: EnrollmentStatus.COMPLETED, promotionDismissedAt: IsNull() } });

    const memberIds = completed.map(row => row.memberId);
    const [members, statuses] = await Promise.all([
      memberIds.length > 0 ? DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(memberIds) } }) : [],
      DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } }),
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

    // 간사는 성도 단계의 다음 칸이 아니다 — 진입 경로가 따로라(면담·과정·헌신) 수료로 간사를 제안하지 않는다 (2026-10-16 사용자)
    return { target: target ? { id: target.id, name: target.name } : null, candidates };
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

  /** 넘기기 — 이 기수에서 고른 사람의 수료 제안(단계·간사)을 더는 띄우지 않는다. */
  async dismiss(churchId: number, cohortId: number, memberIds: number[]): Promise<{ dismissed: number }> {
    await this.load(churchId, cohortId);
    const result = await DataSources.instance
      .getRepository(TrainingEnrollmentEntity)
      .update(
        { churchId, cohortId, memberId: In(memberIds), status: EnrollmentStatus.COMPLETED, promotionDismissedAt: IsNull() },
        { promotionDismissedAt: todayString() }
      );
    return { dismissed: result.affected ?? 0 };
  }

  /**
   * 교회 전체의 놓친 제안. 제안 설정이 있는 과정의 기수 중 넘기지 않은 수료자가 있는 곳만 계산한다
   * (기수 수십 개 규모라 기수별 계산을 그대로 돌린다).
   */
  async pending(churchId: number): Promise<PendingPromotion[]> {
    const courses = await DataSources.instance.getRepository(TrainingCourseEntity).find({ where: { churchId }, withDeleted: true });
    const configured = courses.filter(course => course.completionStatusId);
    if (configured.length === 0) return [];
    const courseName = new Map(courses.map(course => [course.id, course.name]));

    const cohorts = await DataSources.instance
      .getRepository(TrainingCohortEntity)
      .find({ where: { churchId, courseId: In(configured.map(course => course.id)) }, order: { startDate: 'DESC', id: 'DESC' } });
    if (cohorts.length === 0) return [];

    const open = await DataSources.instance.getRepository(TrainingEnrollmentEntity).find({
      select: { cohortId: true },
      where: {
        churchId,
        cohortId: In(cohorts.map(cohort => cohort.id)),
        status: EnrollmentStatus.COMPLETED,
        promotionDismissedAt: IsNull(),
      },
    });
    const withCompleters = new Set(open.map(row => row.cohortId));

    const result: PendingPromotion[] = [];
    for (const cohort of cohorts.filter(row => withCompleters.has(row.id))) {
      const promotions = await this.forCohort(churchId, cohort.id);
      if (promotions.candidates.length === 0) continue;
      result.push({ ...promotions, cohortId: cohort.id, label: `${courseName.get(cohort.courseId) ?? ''} ${cohort.name}`.trim() });
    }
    return result;
  }

  /**
   * 다음 STEP 후보 — 이 과정의 바로 앞 STEP 과정(같은 번호가 여럿이면 모두)을 수료했는데,
   * 이 과정은 어느 기수에서도 듣지 않은 사람. 중도포기했던 사람은 다시 부를 수 있게 후보에 둔다.
   */
  async nextStepCandidates(churchId: number, cohortId: number): Promise<NextStepCandidates> {
    const { course } = await this.load(churchId, cohortId);
    if (!course.step || course.step <= 1) return { previousStep: null, candidates: [] };
    const previousStep = course.step - 1;

    const courseRepo = DataSources.instance.getRepository(TrainingCourseEntity);
    const cohortRepo = DataSources.instance.getRepository(TrainingCohortEntity);
    const enrollmentRepo = DataSources.instance.getRepository(TrainingEnrollmentEntity);

    const previousCourses = await courseRepo.find({ where: { churchId, step: previousStep }, withDeleted: true });
    if (previousCourses.length === 0) return { previousStep, candidates: [] };

    const [previousCohorts, thisCohorts] = await Promise.all([
      cohortRepo.find({ where: { churchId, courseId: In(previousCourses.map(row => row.id)) } }),
      cohortRepo.find({ where: { churchId, courseId: course.id } }),
    ]);
    if (previousCohorts.length === 0) return { previousStep, candidates: [] };

    const [completed, taken] = await Promise.all([
      enrollmentRepo.find({
        where: { churchId, cohortId: In(previousCohorts.map(row => row.id)), status: EnrollmentStatus.COMPLETED },
        order: { closedAt: 'DESC' },
      }),
      thisCohorts.length > 0
        ? enrollmentRepo.find({
            where: { churchId, cohortId: In(thisCohorts.map(row => row.id)), status: Not(EnrollmentStatus.DROPPED) },
          })
        : [],
    ]);
    const takenIds = new Set(taken.map(row => row.memberId));
    // 같은 사람이 이전 STEP 을 두 번 수료했으면 최근 것 하나만
    const latest = new Map<number, TrainingEnrollmentEntity>();
    for (const row of completed) if (!takenIds.has(row.memberId) && !latest.has(row.memberId)) latest.set(row.memberId, row);
    if (latest.size === 0) return { previousStep, candidates: [] };

    const members = await DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(Array.from(latest.keys())) } });
    const cohortById = new Map(previousCohorts.map(row => [row.id, row]));
    const courseById = new Map(previousCourses.map(row => [row.id, row.name]));

    return {
      previousStep,
      candidates: members
        .map(member => {
          const row = latest.get(member.id)!;
          const cohort = cohortById.get(row.cohortId);
          return {
            memberId: member.id,
            memberName: member.name,
            completedLabel: cohort ? `${courseById.get(cohort.courseId) ?? ''} ${cohort.name}`.trim() : '',
            completedAt: row.closedAt ?? null,
          };
        })
        .sort((a, b) => a.memberName.localeCompare(b.memberName, 'ko')),
    };
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
