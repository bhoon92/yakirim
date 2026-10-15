import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { addDays } from '@src/common/date';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { CohortStatus, TrainingCohortEntity } from '@src/database/entities/training-cohort.entity';
import { TrainingCourseEntity, TrainingFormat } from '@src/database/entities/training-course.entity';
import { EnrollmentStatus, TrainingEnrollmentEntity } from '@src/database/entities/training-enrollment.entity';
import { TrainingSessionEntity } from '@src/database/entities/training-session.entity';
import { TrainingAttendanceEntity } from '@src/database/entities/training-attendance.entity';
import { CreateCohortDto, ListCohortQueryDto, UpdateCohortDto, UpdateSessionDto } from './dto/cohort.dto';

/** 목록용 기수 요약 — 진행률까지 계산해서 내려준다. */
export type CohortSummary = {
  id: number;
  courseId: number;
  courseName: string;
  /** 과정에 직접 고른 아이콘. null 이면 화면이 이름으로 자동 배정 */
  courseIcon: string | null;
  name: string;
  label: string;
  startDate: string;
  endDate: string | null;
  status: CohortStatus;
  leaderMemberId: number | null;
  leaderName: string | null;
  sessionCount: number;
  enrolledCount: number;
  completedCount: number;
};

@Injectable()
export class TrainingCohortService {
  private repo() {
    return DataSources.instance.getRepository(TrainingCohortEntity);
  }

  private sessionRepo() {
    return DataSources.instance.getRepository(TrainingSessionEntity);
  }

  private enrollmentRepo() {
    return DataSources.instance.getRepository(TrainingEnrollmentEntity);
  }

  async list(churchId: number, query: ListCohortQueryDto): Promise<CohortSummary[]> {
    const where = {
      churchId,
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const cohorts = await this.repo().find({ where, order: { startDate: 'DESC', id: 'DESC' } });
    if (cohorts.length === 0) return [];

    const [courseMap, leaderMap, sessionCounts, enrollmentRows] = await Promise.all([
      this.courseMap(churchId),
      this.leaderNameMap(churchId, cohorts),
      this.sessionCountMap(cohorts.map(cohort => cohort.id)),
      this.enrollmentRepo().find({ where: { churchId, cohortId: In(cohorts.map(cohort => cohort.id)) } }),
    ]);

    return cohorts.map(cohort => {
      const enrollments = enrollmentRows.filter(row => row.cohortId === cohort.id);
      const course = courseMap.get(cohort.courseId);
      const courseName = course?.name ?? '(삭제된 과정)';
      return {
        id: cohort.id,
        courseId: cohort.courseId,
        courseName,
        courseIcon: course?.icon ?? null,
        name: cohort.name,
        label: `${courseName} ${cohort.name}`,
        startDate: cohort.startDate,
        endDate: cohort.endDate ?? null,
        status: cohort.status,
        leaderMemberId: cohort.leaderMemberId ?? null,
        leaderName: cohort.leaderMemberId ? (leaderMap.get(cohort.leaderMemberId) ?? null) : null,
        sessionCount: sessionCounts.get(cohort.id) ?? 0,
        enrolledCount: enrollments.length,
        completedCount: enrollments.filter(row => row.status === EnrollmentStatus.COMPLETED).length,
      };
    });
  }

  /**
   * 한 건을 목록과 같은 모양(`label`·`courseName`·집계 포함)으로 돌려준다.
   * 생성·수정 응답이 원시 엔티티라 화면 타입(Cohort)과 어긋나 있었다 — 이름 수정 후
   * 응답을 바로 쓰려면 label 이 있어야 한다.
   */
  async summaryById(churchId: number, id: number): Promise<CohortSummary> {
    const cohort = await this.findById(churchId, id);
    // 같은 과정으로 범위를 좁혀 목록 조립을 재사용한다(기수 수가 적어 따로 최적화하지 않는다).
    const rows = await this.list(churchId, { courseId: cohort.courseId } as ListCohortQueryDto);
    const summary = rows.find(row => row.id === id);
    if (!summary) throw new NotFoundException('기수를 찾을 수 없습니다.');
    return summary;
  }

  async findById(churchId: number, id: number): Promise<TrainingCohortEntity> {
    const cohort = await this.repo().findOne({ where: { id, churchId } });
    if (!cohort) throw new NotFoundException('기수를 찾을 수 없습니다.');
    return cohort;
  }

  /** 기수 개설 — 회차를 함께 만든다 (한 트랜잭션). 회차 없이 만든 기수는 출석 체크를 할 수 없어서. */
  async create(churchId: number, dto: CreateCohortDto): Promise<CohortSummary> {
    const course = await DataSources.instance.getRepository(TrainingCourseEntity).findOne({ where: { id: dto.courseId, churchId } });
    if (!course) throw new NotFoundException('훈련 과정을 찾을 수 없습니다.');

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('기수 이름을 입력하세요.');
    await this.assertNameFree(churchId, dto.courseId, name);
    const sessionCount = dto.sessionCount ?? course.defaultSessionCount;
    const sessionDates = Array.from({ length: sessionCount }, (_unused, index) => sessionDateFor(course.format, dto.startDate, index));
    // 종료일을 안 주면 마지막 회차 날짜로 — 목록의 "시작 ~ 종료"가 비어 보이지 않게
    const lastDate = sessionDates.filter((date): date is string => date !== null).at(-1);

    const created = await DataSources.instance.transaction(async manager => {
      const cohort = await manager.getRepository(TrainingCohortEntity).save(
        manager.getRepository(TrainingCohortEntity).create({
          churchId,
          courseId: dto.courseId,
          name,
          startDate: dto.startDate,
          endDate: dto.endDate ?? (lastDate && lastDate !== dto.startDate ? lastDate : undefined),
          status: CohortStatus.PLANNED,
          leaderMemberId: dto.leaderMemberId,
          note: dto.note,
        })
      );

      const sessions = Array.from({ length: sessionCount }, (_unused, index) =>
        manager.getRepository(TrainingSessionEntity).create({
          churchId,
          cohortId: cohort.id,
          sequence: index + 1,
          date: sessionDates[index] ?? undefined,
        })
      );
      if (sessions.length > 0) await manager.getRepository(TrainingSessionEntity).save(sessions);

      return cohort;
    });
    return this.summaryById(churchId, created.id);
  }

  /** sessionCount 는 개설 시에만 의미가 있어 수정에서는 무시한다 (회차 증감은 addSession 사용). */
  async update(churchId: number, id: number, dto: UpdateCohortDto): Promise<CohortSummary> {
    const current = await this.findById(churchId, id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('기수 이름을 입력하세요.');
      // 과정을 함께 옮기는 경우도 있어 "옮겨갈 과정" 기준으로 검사한다.
      const courseId = dto.courseId ?? current.courseId;
      if (name !== current.name || courseId !== current.courseId) {
        await this.assertNameFree(churchId, courseId, name, id);
      }
      dto.name = name;
    }

    const editable = ['courseId', 'name', 'startDate', 'endDate', 'status', 'leaderMemberId', 'note'] as const;
    const patch: Partial<TrainingCohortEntity> = {};
    for (const key of editable) {
      if (dto[key] !== undefined) Object.assign(patch, { [key]: dto[key] });
    }
    await this.repo().update({ id, churchId }, patch);
    return this.summaryById(churchId, id);
  }

  /** 기수 삭제 — 회차·수강·출석까지 함께 정리한다. */
  async remove(churchId: number, id: number): Promise<void> {
    await this.findById(churchId, id);
    await DataSources.instance.transaction(async manager => {
      const sessions = await manager.getRepository(TrainingSessionEntity).find({ where: { churchId, cohortId: id } });
      const enrollments = await manager.getRepository(TrainingEnrollmentEntity).find({ where: { churchId, cohortId: id } });
      if (sessions.length > 0) {
        await manager.getRepository(TrainingAttendanceEntity).softDelete({ sessionId: In(sessions.map(s => s.id)) });
        await manager.getRepository(TrainingSessionEntity).softDelete({ id: In(sessions.map(s => s.id)) });
      }
      if (enrollments.length > 0) {
        await manager.getRepository(TrainingEnrollmentEntity).softDelete({ id: In(enrollments.map(e => e.id)) });
      }
      await manager.getRepository(TrainingCohortEntity).softDelete({ id, churchId });
    });
  }

  async listSessions(churchId: number, cohortId: number): Promise<TrainingSessionEntity[]> {
    await this.findById(churchId, cohortId);
    return this.sessionRepo().find({ where: { churchId, cohortId }, order: { sequence: 'ASC' } });
  }

  async updateSession(churchId: number, sessionId: number, dto: UpdateSessionDto): Promise<TrainingSessionEntity> {
    const session = await this.sessionRepo().findOne({ where: { id: sessionId, churchId } });
    if (!session) throw new NotFoundException('회차를 찾을 수 없습니다.');
    await this.sessionRepo().update({ id: sessionId, churchId }, dto);
    return (await this.sessionRepo().findOne({ where: { id: sessionId, churchId } }))!;
  }

  /** 회차 추가 — 과정보다 길게 진행될 때. */
  async addSession(churchId: number, cohortId: number): Promise<TrainingSessionEntity> {
    await this.findById(churchId, cohortId);
    const last = await this.sessionRepo().findOne({ where: { churchId, cohortId }, order: { sequence: 'DESC' } });
    return this.sessionRepo().save(this.sessionRepo().create({ churchId, cohortId, sequence: (last?.sequence ?? 0) + 1 }));
  }

  /**
   * 회차 삭제 — 그 회차의 출석 기록을 함께 정리하고 남은 회차 번호를 1부터 다시 매긴다.
   *
   * 번호를 그대로 두면 표 머리글이 1·2·4·5… 로 보여 버그처럼 읽힌다. 회차의 정체성은 id 이고
   * 출석도 sessionId 로 물려 있어서 번호를 당겨도 기록은 어긋나지 않는다.
   */
  async removeSession(churchId: number, sessionId: number): Promise<void> {
    const session = await this.sessionRepo().findOne({ where: { id: sessionId, churchId } });
    if (!session) throw new NotFoundException('회차를 찾을 수 없습니다.');

    await DataSources.instance.transaction(async manager => {
      await manager.getRepository(TrainingAttendanceEntity).softDelete({ sessionId });
      await manager.getRepository(TrainingSessionEntity).softDelete({ id: sessionId, churchId });

      // (cohort_id, sequence) 는 살아있는 행에만 걸리는 부분 유니크 인덱스다.
      // 번호를 당길 때 반드시 오름차순으로 처리해야 앞 자리가 먼저 비어 충돌하지 않는다.
      const rest = await manager
        .getRepository(TrainingSessionEntity)
        .find({ where: { churchId, cohortId: session.cohortId }, order: { sequence: 'ASC' } });
      for (const [index, row] of rest.entries()) {
        const next = index + 1;
        if (row.sequence !== next) {
          await manager.getRepository(TrainingSessionEntity).update({ id: row.id }, { sequence: next });
        }
      }
    });
  }

  /**
   * 같은 과정 안에서 기수 이름이 겹치는지. DB 에도 부분 유니크 인덱스가 있지만
   * 그대로 터뜨리면 사용자에게 Postgres 오류가 그대로 보인다.
   */
  private async assertNameFree(churchId: number, courseId: number, name: string, exceptId?: number): Promise<void> {
    const existing = await this.repo().findOne({ where: { churchId, courseId, name } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`이 과정에 "${name}" 기수가 이미 있습니다.`);
    }
  }

  private async courseMap(churchId: number): Promise<Map<number, TrainingCourseEntity>> {
    const courses = await DataSources.instance.getRepository(TrainingCourseEntity).find({ where: { churchId } });
    return new Map(courses.map(course => [course.id, course]));
  }

  private async leaderNameMap(churchId: number, cohorts: TrainingCohortEntity[]): Promise<Map<number, string>> {
    const ids = Array.from(new Set(cohorts.map(cohort => cohort.leaderMemberId).filter((id): id is number => Boolean(id))));
    if (ids.length === 0) return new Map();
    const members = await DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(ids) } });
    return new Map(members.map(member => [member.id, member.name]));
  }

  private async sessionCountMap(cohortIds: number[]): Promise<Map<number, number>> {
    if (cohortIds.length === 0) return new Map();
    const rows = (await this.sessionRepo()
      .createQueryBuilder('s')
      .select('s.cohort_id', 'cohortId')
      .addSelect('COUNT(*)', 'count')
      .where('s.cohort_id IN (:...cohortIds)', { cohortIds })
      .andWhere('s.deleted_at IS NULL')
      .groupBy('s.cohort_id')
      .getRawMany()) as { cohortId: number; count: string }[];
    return new Map(rows.map(row => [Number(row.cohortId), Number(row.count)]));
  }
}

/**
 * 기수 개설 때 회차 날짜를 미리 채운다 — 빈 날짜 열두 칸을 하나씩 고르게 하지 않으려고.
 * 매주 과정은 7일 간격, 수련회·합숙은 하루씩, 그 밖에는 첫 회차만. 나중에 회차별로 고칠 수 있다.
 */
function sessionDateFor(format: TrainingFormat, startDate: string, index: number): string | null {
  switch (format) {
    case TrainingFormat.WEEKLY:
      return addDays(startDate, index * 7);
    case TrainingFormat.RETREAT:
    case TrainingFormat.INTENSIVE:
      return addDays(startDate, index);
    default:
      return index === 0 ? startDate : null;
  }
}
