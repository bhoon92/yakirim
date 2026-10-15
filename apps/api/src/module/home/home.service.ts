import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { CalendarEntity } from '@src/database/entities/calendar.entity';
import { FinanceTransactionEntity, TransactionFlow } from '@src/database/entities/finance-transaction.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MissionaryNoteEntity } from '@src/database/entities/missionary-note.entity';
import { MissionaryStageEntity } from '@src/database/entities/missionary-stage.entity';
import { OfferingCategoryEntity } from '@src/database/entities/offering-category.entity';
import { OfferingEntity } from '@src/database/entities/offering.entity';
import { CohortStatus, TrainingCohortEntity } from '@src/database/entities/training-cohort.entity';
import { TrainingCourseEntity } from '@src/database/entities/training-course.entity';
import { EnrollmentStatus, TrainingEnrollmentEntity } from '@src/database/entities/training-enrollment.entity';
import { TrainingSessionEntity } from '@src/database/entities/training-session.entity';
import { CalendarEventService } from '@src/module/calendar/calendar-event.service';
import { MissionaryService } from '@src/module/missionary/missionary.service';
import { TrainingEnrollmentService } from '@src/module/training/enrollment.service';

export type HomeScheduleItem = {
  id: number;
  title: string;
  startAt: string;
  allDay: boolean;
  layer: string;
  color: string;
};

export type HomeActivityItem = {
  kind: 'offering' | 'member' | 'transaction' | 'training' | 'missionary';
  who: string;
  what: string;
  at: string;
};

/** 양성 파이프라인 분포 — 재적상태(단계)별 인원. */
export type PipelineStage = {
  statusId: number;
  name: string;
  count: number;
};

export type OngoingCohort = {
  cohortId: number;
  label: string;
  startDate: string;
  enrolledCount: number;
  sessionCount: number;
};

/**
 * 홈 대시보드 — 이 교회의 핵심 지표는 출석/헌금이 아니라 **얼마나 배출했는가**다 (planning 00.2).
 * 재정 지표는 /finance/dashboard 로 분리되어 있다.
 */
export type HomeDashboard = {
  stats: {
    /** 현재 파송 인원 — 교회가 `countsAsActive` 로 지정한 단계에 있는 사람. */
    activeMissionaries: number;
    /** 올해 파송 확정된 인원. */
    commissionedThisYear: number;
    /** 진행 중인 훈련 기수 수. */
    ongoingCohorts: number;
    /** 올해 훈련 수료 인원. */
    completedThisYear: number;
  };
  pipeline: PipelineStage[];
  training: OngoingCohort[];
  schedule: HomeScheduleItem[];
  activity: HomeActivityItem[];
};

@Injectable()
export class HomeService {
  constructor(
    private readonly calendarEvents: CalendarEventService,
    private readonly missionaries: MissionaryService,
    private readonly enrollments: TrainingEnrollmentService
  ) {}

  async summary(churchId: number): Promise<HomeDashboard> {
    const now = new Date();
    const year = now.getFullYear();
    const day = this.dayRange(now);

    const [missionarySummary, completedThisYear, pipeline, training, schedule, activity] = await Promise.all([
      this.missionaries.summary(churchId),
      this.enrollments.completedCount(churchId, `${year}-01-01`, `${year}-12-31`),
      this.pipeline(churchId),
      this.ongoingCohorts(churchId),
      this.todaySchedule(churchId, day.start, day.end),
      this.recentActivity(churchId),
    ]);

    return {
      stats: {
        activeMissionaries: missionarySummary.active,
        commissionedThisYear: missionarySummary.commissionedThisYear,
        ongoingCohorts: training.length,
        completedThisYear,
      },
      pipeline,
      training,
      schedule,
      activity,
    };
  }

  /** 재적상태(파이프라인 단계)별 인원. 활성 상태만, 정렬순서대로. */
  private async pipeline(churchId: number): Promise<PipelineStage[]> {
    const statuses = await DataSources.instance.getRepository(MemberStatusEntity).find({
      where: { churchId, isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (statuses.length === 0) return [];

    const rows = (await DataSources.instance
      .getRepository(MemberEntity)
      .createQueryBuilder('m')
      .select('m.status_id', 'statusId')
      .addSelect('COUNT(*)', 'count')
      .where('m.church_id = :churchId', { churchId })
      .andWhere('m.deleted_at IS NULL')
      .groupBy('m.status_id')
      .getRawMany()) as { statusId: number; count: string }[];
    const countMap = new Map(rows.map(row => [Number(row.statusId), Number(row.count)]));

    return statuses.map(status => ({
      statusId: status.id,
      name: status.name,
      count: countMap.get(status.id) ?? 0,
    }));
  }

  /** 진행 중(ongoing) 기수 — 수강 인원과 회차 수를 붙여서. */
  private async ongoingCohorts(churchId: number): Promise<OngoingCohort[]> {
    const cohorts = await DataSources.instance.getRepository(TrainingCohortEntity).find({
      where: { churchId, status: CohortStatus.ONGOING },
      order: { startDate: 'ASC' },
    });
    if (cohorts.length === 0) return [];

    const cohortIds = cohorts.map(cohort => cohort.id);
    const [courses, enrollments, sessions] = await Promise.all([
      DataSources.instance.getRepository(TrainingCourseEntity).find({ where: { churchId } }),
      DataSources.instance.getRepository(TrainingEnrollmentEntity).find({ where: { churchId, cohortId: In(cohortIds) } }),
      DataSources.instance.getRepository(TrainingSessionEntity).find({ where: { churchId, cohortId: In(cohortIds) } }),
    ]);
    const courseMap = new Map(courses.map(course => [course.id, course.name]));

    return cohorts.map(cohort => ({
      cohortId: cohort.id,
      label: `${courseMap.get(cohort.courseId) ?? '훈련'} ${cohort.name}`,
      startDate: cohort.startDate,
      enrolledCount: enrollments.filter(row => row.cohortId === cohort.id).length,
      sessionCount: sessions.filter(row => row.cohortId === cohort.id).length,
    }));
  }

  /** 오늘 시작하는 일정 (반복 occurrence 포함, 시작 시각 오름차순). */
  private async todaySchedule(churchId: number, start: Date, end: Date): Promise<HomeScheduleItem[]> {
    // CalendarEventService.list 가 반복 일정을 occurrence 로 펼쳐줌 → 달력 화면과 일관.
    const events = (await this.calendarEvents.list(churchId, start.toISOString(), end.toISOString())).slice(0, 8);
    if (events.length === 0) return [];

    const calendarIds = Array.from(new Set(events.map(event => event.calendarId)));
    const calendars = await DataSources.instance.getRepository(CalendarEntity).find({ where: { id: In(calendarIds), churchId } });
    const calendarMap = new Map(calendars.map(calendar => [calendar.id, calendar]));

    return events.map(event => {
      const calendar = calendarMap.get(event.calendarId);
      return {
        id: event.id,
        title: event.title,
        startAt: event.startAt,
        allDay: event.allDay,
        layer: calendar?.name ?? '일정',
        color: calendar?.color ?? 'oklch(0.6 0.14 250)',
      };
    });
  }

  /** 최근 활동 — 수료·파송 전이를 우선으로 하고 등록/헌금/지출을 섞는다. */
  private async recentActivity(churchId: number): Promise<HomeActivityItem[]> {
    const [completions, stageChanges, members, offerings, transactions] = await Promise.all([
      DataSources.instance.getRepository(TrainingEnrollmentEntity).find({
        where: { churchId, status: EnrollmentStatus.COMPLETED },
        order: { updatedAt: 'DESC' },
        take: 6,
      }),
      DataSources.instance.getRepository(MissionaryNoteEntity).find({
        where: { churchId },
        order: { createdAt: 'DESC' },
        take: 6,
      }),
      DataSources.instance.getRepository(MemberEntity).find({ where: { churchId }, order: { createdAt: 'DESC' }, take: 6 }),
      DataSources.instance.getRepository(OfferingEntity).find({ where: { churchId }, order: { createdAt: 'DESC' }, take: 4 }),
      DataSources.instance.getRepository(FinanceTransactionEntity).find({ where: { churchId }, order: { createdAt: 'DESC' }, take: 4 }),
    ]);

    const [trainingItems, missionaryItems, memberItems, offeringItems] = await Promise.all([
      this.toTrainingActivity(churchId, completions),
      this.toMissionaryActivity(churchId, stageChanges),
      this.toMemberActivity(churchId, members),
      this.toOfferingActivity(churchId, offerings),
    ]);

    const items: HomeActivityItem[] = [
      ...trainingItems,
      ...missionaryItems,
      ...memberItems,
      ...offeringItems,
      ...transactions.map(transaction => ({
        kind: 'transaction' as const,
        who: '회계',
        what: `${transaction.title} ${transaction.flow === TransactionFlow.EXPENSE ? '지출' : '수입'} ${this.krw(transaction.amount)}`,
        at: transaction.createdAt.toISOString(),
      })),
    ];

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }

  private async toTrainingActivity(churchId: number, rows: TrainingEnrollmentEntity[]): Promise<HomeActivityItem[]> {
    if (rows.length === 0) return [];
    const [names, cohorts, courses] = await Promise.all([
      this.memberNameMap(
        churchId,
        rows.map(row => row.memberId)
      ),
      DataSources.instance.getRepository(TrainingCohortEntity).find({ where: { churchId, id: In(rows.map(row => row.cohortId)) } }),
      DataSources.instance.getRepository(TrainingCourseEntity).find({ where: { churchId } }),
    ]);
    const cohortMap = new Map(cohorts.map(cohort => [cohort.id, cohort]));
    const courseMap = new Map(courses.map(course => [course.id, course.name]));

    return rows.map(row => {
      const cohort = cohortMap.get(row.cohortId);
      const label = cohort ? `${courseMap.get(cohort.courseId) ?? '훈련'} ${cohort.name}` : '훈련';
      return {
        kind: 'training' as const,
        who: names.get(row.memberId) ?? '성도',
        what: `${label} 수료`,
        at: row.updatedAt.toISOString(),
      };
    });
  }

  /** 선교사 기록 피드 — 단계가 지정된 기록은 "○○ 단계", 메모만 있으면 메모 앞부분을 보여준다. */
  private async toMissionaryActivity(churchId: number, rows: MissionaryNoteEntity[]): Promise<HomeActivityItem[]> {
    if (rows.length === 0) return [];
    const [items, stages] = await Promise.all([
      this.missionaries.list(churchId, {}),
      DataSources.instance.getRepository(MissionaryStageEntity).find({ where: { churchId } }),
    ]);
    const byProfile = new Map(items.map(item => [item.id, item]));
    const stageMap = new Map(stages.map(stage => [stage.id, stage.name]));

    return rows.map(row => {
      const stageName = row.stageId ? stageMap.get(row.stageId) : undefined;
      const summary = row.content.length > 30 ? `${row.content.slice(0, 30)}…` : row.content;
      return {
        kind: 'missionary' as const,
        who: byProfile.get(row.missionaryId)?.memberName ?? '선교사',
        what: stageName ? `${stageName} 단계 — ${summary}` : summary,
        at: row.createdAt.toISOString(),
      };
    });
  }

  private async toMemberActivity(churchId: number, rows: MemberEntity[]): Promise<HomeActivityItem[]> {
    if (rows.length === 0) return [];
    const statuses = await DataSources.instance.getRepository(MemberStatusEntity).find({ where: { churchId } });
    const statusMap = new Map(statuses.map(status => [status.id, status.name]));
    return rows.map(member => ({
      kind: 'member' as const,
      who: member.name,
      what: `${statusMap.get(member.statusId) ?? '교인'} 등록`,
      at: member.createdAt.toISOString(),
    }));
  }

  private async toOfferingActivity(churchId: number, rows: OfferingEntity[]): Promise<HomeActivityItem[]> {
    if (rows.length === 0) return [];
    const [names, categories] = await Promise.all([
      this.memberNameMap(
        churchId,
        rows.map(row => row.memberId)
      ),
      DataSources.instance.getRepository(OfferingCategoryEntity).find({ where: { churchId } }),
    ]);
    const categoryMap = new Map(categories.map(category => [category.id, category.name]));
    return rows.map(offering => ({
      kind: 'offering' as const,
      who: names.get(offering.memberId) ?? offering.rawDonorName ?? '익명',
      what: `${categoryMap.get(offering.offeringCategoryId) ?? '헌금'} ${this.krw(offering.amount)}`,
      at: offering.createdAt.toISOString(),
    }));
  }

  private async memberNameMap(churchId: number, memberIds: number[]): Promise<Map<number, string>> {
    const ids = Array.from(new Set(memberIds));
    if (ids.length === 0) return new Map();
    const members = await DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(ids) } });
    return new Map(members.map(member => [member.id, member.name]));
  }

  private krw(amount: number): string {
    return `₩${amount.toLocaleString()}`;
  }

  private dayRange(now: Date): { start: Date; end: Date } {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start, end };
  }
}
