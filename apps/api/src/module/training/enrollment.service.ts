import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { DataSources } from '@src/database/data-sources';
import { MemberEntity } from '@src/database/entities/member.entity';
import { TrainingAttendanceEntity } from '@src/database/entities/training-attendance.entity';
import { CohortStatus, TrainingCohortEntity } from '@src/database/entities/training-cohort.entity';
import { TrainingCourseEntity } from '@src/database/entities/training-course.entity';
import { EnrollmentStatus, TrainingEnrollmentEntity } from '@src/database/entities/training-enrollment.entity';
import { TrainingSessionEntity } from '@src/database/entities/training-session.entity';
import { todayString } from '@src/common/date';
import { EnrollMembersDto, MarkTrainingAttendanceDto, UpdateEnrollmentDto } from './dto/cohort.dto';

/** 기수 상세 — 회차 × 수강생 출석 매트릭스. 화면 하나를 그대로 채우는 형태로 내려준다. */
export type CohortDetail = {
  sessions: { id: number; sequence: number; date: string | null; topic: string | null }[];
  roster: {
    enrollmentId: number;
    memberId: number;
    memberName: string;
    status: EnrollmentStatus;
    attendedSessionIds: number[];
    attendanceRate: number;
  }[];
};

/** 교인 한 명의 훈련 이력 — 양성 경로 그 자체. */
export type MemberTrainingHistory = {
  enrollmentId: number;
  cohortId: number;
  courseName: string;
  name: string;
  label: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  closedAt: string | null;
  attendanceRate: number;
};

@Injectable()
export class TrainingEnrollmentService {
  private repo() {
    return DataSources.instance.getRepository(TrainingEnrollmentEntity);
  }

  private attendanceRepo() {
    return DataSources.instance.getRepository(TrainingAttendanceEntity);
  }

  /** 여러 명 한 번에 등록. 이미 등록된 교인은 건너뛰고, 실제로 추가된 수를 돌려준다. */
  async enroll(churchId: number, cohortId: number, dto: EnrollMembersDto): Promise<{ added: number; skipped: number }> {
    await this.assertCohort(churchId, cohortId);

    const members = await DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(dto.memberIds) } });
    const validIds = new Set(members.map(member => member.id));

    const existing = await this.repo().find({ where: { churchId, cohortId, memberId: In(dto.memberIds) } });
    const existingIds = new Set(existing.map(row => row.memberId));

    const toAdd = dto.memberIds.filter(id => validIds.has(id) && !existingIds.has(id));
    if (toAdd.length > 0) {
      await this.repo().save(
        toAdd.map(memberId =>
          this.repo().create({ churchId, cohortId, memberId, status: EnrollmentStatus.ENROLLED, enrolledAt: this.today() })
        )
      );
    }
    return { added: toAdd.length, skipped: dto.memberIds.length - toAdd.length };
  }

  /**
   * 수강 상태 변경 (수료/중도포기 확정).
   * 출석률로 자동 판정하지 않는 것은 의도된 설계다 (planning 00.3).
   */
  async updateStatus(churchId: number, enrollmentId: number, dto: UpdateEnrollmentDto): Promise<TrainingEnrollmentEntity> {
    const enrollment = await this.repo().findOne({ where: { id: enrollmentId, churchId } });
    if (!enrollment) throw new NotFoundException('수강 정보를 찾을 수 없습니다.');

    // 수강 중으로 되돌리면 확정일을 지운다 — 남겨두면 "수강 중인데 수료일이 있는" 상태가 된다.
    const closed = dto.status !== EnrollmentStatus.ENROLLED;
    await this.repo().update(
      { id: enrollmentId, churchId },
      {
        status: dto.status,
        closedAt: closed ? (dto.closedAt ?? this.today()) : null,
        note: dto.note ?? enrollment.note,
        // 상태가 바뀌면 "넘긴 제안"도 무효다 — 수료를 취소했다 다시 수료하면 제안이 다시 떠야 한다
        ...(dto.status !== enrollment.status ? { promotionDismissedAt: null } : {}),
      }
    );
    if (closed) await this.startIfPlanned(churchId, enrollment.cohortId);
    return (await this.repo().findOne({ where: { id: enrollmentId, churchId } }))!;
  }

  /**
   * 출석을 처음 체크하거나 수료를 처리하면 그 기수는 시작된 것이다 — "예정"이면 "진행 중"으로 옮긴다.
   * 그대로 두면 홈의 "진행 중 훈련"이 0 으로 남았다. 종료는 사람이 정한다(언제 끝났는지는 운영 판단).
   */
  private async startIfPlanned(churchId: number, cohortId: number): Promise<void> {
    await DataSources.instance
      .getRepository(TrainingCohortEntity)
      .update({ id: cohortId, churchId, status: CohortStatus.PLANNED }, { status: CohortStatus.ONGOING });
  }

  async remove(churchId: number, enrollmentId: number): Promise<void> {
    const enrollment = await this.repo().findOne({ where: { id: enrollmentId, churchId } });
    if (!enrollment) throw new NotFoundException('수강 정보를 찾을 수 없습니다.');
    await DataSources.instance.transaction(async manager => {
      await manager.getRepository(TrainingAttendanceEntity).softDelete({ enrollmentId });
      await manager.getRepository(TrainingEnrollmentEntity).softDelete({ id: enrollmentId, churchId });
    });
  }

  /** 회차 출석 토글 — 예배 출석(mark)과 같은 멱등 방식. */
  async markAttendance(churchId: number, sessionId: number, dto: MarkTrainingAttendanceDto): Promise<{ present: boolean }> {
    const session = await DataSources.instance.getRepository(TrainingSessionEntity).findOne({ where: { id: sessionId, churchId } });
    if (!session) throw new NotFoundException('회차를 찾을 수 없습니다.');

    const enrollment = await this.repo().findOne({ where: { id: dto.enrollmentId, churchId, cohortId: session.cohortId } });
    if (!enrollment) throw new NotFoundException('이 기수의 수강생이 아닙니다.');

    const existing = await this.attendanceRepo().findOne({ where: { churchId, sessionId, enrollmentId: dto.enrollmentId } });

    if (dto.present) {
      if (!existing) {
        await this.attendanceRepo().save(this.attendanceRepo().create({ churchId, sessionId, enrollmentId: dto.enrollmentId }));
      }
      await this.startIfPlanned(churchId, session.cohortId);
      return { present: true };
    }
    if (existing) await this.attendanceRepo().softDelete(existing.id);
    return { present: false };
  }

  async detail(churchId: number, cohortId: number): Promise<CohortDetail> {
    await this.assertCohort(churchId, cohortId);

    const [sessions, enrollments] = await Promise.all([
      DataSources.instance.getRepository(TrainingSessionEntity).find({ where: { churchId, cohortId }, order: { sequence: 'ASC' } }),
      this.repo().find({ where: { churchId, cohortId }, order: { id: 'ASC' } }),
    ]);

    const memberIds = enrollments.map(row => row.memberId);
    const members =
      memberIds.length > 0 ? await DataSources.instance.getRepository(MemberEntity).find({ where: { churchId, id: In(memberIds) } }) : [];
    const nameMap = new Map(members.map(member => [member.id, member.name]));

    const attendances =
      sessions.length > 0 ? await this.attendanceRepo().find({ where: { churchId, sessionId: In(sessions.map(s => s.id)) } }) : [];

    return {
      sessions: sessions.map(session => ({
        id: session.id,
        sequence: session.sequence,
        date: session.date ?? null,
        topic: session.topic ?? null,
      })),
      roster: enrollments.map(enrollment => {
        const attendedSessionIds = attendances.filter(row => row.enrollmentId === enrollment.id).map(row => row.sessionId);
        return {
          enrollmentId: enrollment.id,
          memberId: enrollment.memberId,
          memberName: nameMap.get(enrollment.memberId) ?? '(삭제된 교인)',
          status: enrollment.status,
          attendedSessionIds,
          attendanceRate: sessions.length === 0 ? 0 : Math.round((attendedSessionIds.length / sessions.length) * 100),
        };
      }),
    };
  }

  /** 교인 상세 화면용 — 이 사람이 무엇을 통과했는지. */
  async historyForMember(churchId: number, memberId: number): Promise<MemberTrainingHistory[]> {
    const enrollments = await this.repo().find({ where: { churchId, memberId }, order: { enrolledAt: 'DESC', id: 'DESC' } });
    if (enrollments.length === 0) return [];

    const cohorts = await DataSources.instance
      .getRepository(TrainingCohortEntity)
      .find({ where: { churchId, id: In(enrollments.map(row => row.cohortId)) } });
    const cohortMap = new Map(cohorts.map(cohort => [cohort.id, cohort]));

    const courses = await DataSources.instance.getRepository(TrainingCourseEntity).find({ where: { churchId } });
    const courseMap = new Map(courses.map(course => [course.id, course.name]));

    const sessionRows = await DataSources.instance
      .getRepository(TrainingSessionEntity)
      .find({ where: { churchId, cohortId: In(enrollments.map(row => row.cohortId)) } });
    const attendances = await this.attendanceRepo().find({ where: { churchId, enrollmentId: In(enrollments.map(row => row.id)) } });

    return enrollments.map(enrollment => {
      const cohort = cohortMap.get(enrollment.cohortId);
      const courseName = cohort ? (courseMap.get(cohort.courseId) ?? '(삭제된 과정)') : '(삭제된 기수)';
      const total = sessionRows.filter(session => session.cohortId === enrollment.cohortId).length;
      const attended = attendances.filter(row => row.enrollmentId === enrollment.id).length;
      return {
        enrollmentId: enrollment.id,
        cohortId: enrollment.cohortId,
        courseName,
        name: cohort?.name ?? '',
        label: cohort ? `${courseName} ${cohort.name}` : courseName,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        closedAt: enrollment.closedAt ?? null,
        attendanceRate: total === 0 ? 0 : Math.round((attended / total) * 100),
      };
    });
  }

  /** 대시보드용 — 수료 인원 수 (기간 옵션). */
  async completedCount(churchId: number, from?: string, to?: string): Promise<number> {
    const qb = this.repo()
      .createQueryBuilder('e')
      .where('e.church_id = :churchId', { churchId })
      .andWhere('e.status = :status', { status: EnrollmentStatus.COMPLETED });
    if (from && to) qb.andWhere('e.closed_at BETWEEN :from AND :to', { from, to });
    return qb.getCount();
  }

  private async assertCohort(churchId: number, cohortId: number): Promise<void> {
    const cohort = await DataSources.instance.getRepository(TrainingCohortEntity).findOne({ where: { id: cohortId, churchId } });
    if (!cohort) throw new NotFoundException('기수를 찾을 수 없습니다.');
  }

  private today(): string {
    return todayString();
  }
}
