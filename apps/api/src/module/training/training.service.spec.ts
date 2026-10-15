import { DataSource } from 'typeorm';
import { MemberStatusHistoryEntity } from '@src/database/entities/member-status-history.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { CohortStatus, TrainingCohortEntity } from '@src/database/entities/training-cohort.entity';
import { TrainingCourseEntity, TrainingFormat } from '@src/database/entities/training-course.entity';
import { EnrollmentStatus } from '@src/database/entities/training-enrollment.entity';
import { TrainingAttendanceEntity } from '@src/database/entities/training-attendance.entity';
import { MemberStatusHistoryService } from '@src/module/member/member-status-history.service';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { TrainingCohortService } from './cohort.service';
import { TrainingEnrollmentService } from './enrollment.service';
import { TrainingPromotionService } from './promotion.service';

describe('훈련 (실제 Postgres)', () => {
  let dataSource: DataSource;
  const history = new MemberStatusHistoryService();
  const cohorts = new TrainingCohortService();
  const enrollments = new TrainingEnrollmentService();
  const promotions = new TrainingPromotionService(history);

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function status(churchId: number, name: string, sortOrder: number) {
    const repo = dataSource.getRepository(MemberStatusEntity);
    return repo.save(repo.create({ churchId, name, sortOrder }));
  }

  async function member(churchId: number, name: string, statusId: number) {
    const repo = dataSource.getRepository(MemberEntity);
    const row = await repo.save(repo.create({ churchId, name, statusId }));
    await history.record(dataSource.manager, churchId, row.id, statusId, { date: '2026-01-01' });
    return row;
  }

  async function course(churchId: number, options: Partial<TrainingCourseEntity> = {}) {
    const repo = dataSource.getRepository(TrainingCourseEntity);
    return repo.save(repo.create({ churchId, name: '제자훈련', format: TrainingFormat.WEEKLY, defaultSessionCount: 5, ...options }));
  }

  describe('회차', () => {
    it('기수를 열면 회차를 만들고 날짜를 매주 채운다', async () => {
      const churchId = await newChurch(dataSource);
      const { id: courseId } = await course(churchId);
      const cohort = await cohorts.create(churchId, { courseId, name: '1기', startDate: '2026-03-01', sessionCount: 3 });

      const sessions = await cohorts.listSessions(churchId, cohort.id);
      expect(sessions.map(s => [s.sequence, s.date])).toEqual([
        [1, '2026-03-01'],
        [2, '2026-03-08'],
        [3, '2026-03-15'],
      ]);
      expect(cohort.endDate).toBe('2026-03-15');
    });

    // (cohort_id, sequence) 부분 유니크 인덱스 — 내림차순으로 당기면 충돌한다 (HANDOFF §4.3)
    it('회차를 지우면 남은 회차 번호를 1부터 다시 매기고, 다른 회차 출석은 그대로 둔다', async () => {
      const churchId = await newChurch(dataSource);
      const { id: courseId } = await course(churchId);
      const visit = await status(churchId, '새가족', 1);
      const person = await member(churchId, '가', visit.id);
      const cohort = await cohorts.create(churchId, { courseId, name: '1기', startDate: '2026-03-01', sessionCount: 5 });
      await enrollments.enroll(churchId, cohort.id, { memberIds: [person.id] });
      const [s1, s2, s3, s4, s5] = await cohorts.listSessions(churchId, cohort.id);
      const {
        roster: [enrolled],
      } = await enrollments.detail(churchId, cohort.id);
      await enrollments.markAttendance(churchId, s2.id, { enrollmentId: enrolled.enrollmentId, present: true });
      await enrollments.markAttendance(churchId, s4.id, { enrollmentId: enrolled.enrollmentId, present: true });

      await cohorts.removeSession(churchId, s2.id);
      await cohorts.removeSession(churchId, s1.id); // 맨 앞을 지워도 충돌 없이 당겨져야 한다

      const left = await cohorts.listSessions(churchId, cohort.id);
      expect(left.map(s => [s.id, s.sequence])).toEqual([
        [s3.id, 1],
        [s4.id, 2],
        [s5.id, 3],
      ]);
      const attendance = await dataSource.getRepository(TrainingAttendanceEntity).find({ where: { churchId } });
      expect(attendance.map(a => a.sessionId)).toEqual([s4.id]);
    });

    it('첫 출석을 체크하면 예정 기수가 진행 중이 된다', async () => {
      const churchId = await newChurch(dataSource);
      const { id: courseId } = await course(churchId);
      const visit = await status(churchId, '새가족', 1);
      const person = await member(churchId, '가', visit.id);
      const cohort = await cohorts.create(churchId, { courseId, name: '1기', startDate: '2026-03-01', sessionCount: 2 });
      await enrollments.enroll(churchId, cohort.id, { memberIds: [person.id] });
      const [first] = await cohorts.listSessions(churchId, cohort.id);
      const {
        roster: [enrolled],
      } = await enrollments.detail(churchId, cohort.id);
      expect(cohort.status).toBe(CohortStatus.PLANNED);

      await enrollments.markAttendance(churchId, first.id, { enrollmentId: enrolled.enrollmentId, present: true });

      const after = await dataSource.getRepository(TrainingCohortEntity).findOneByOrFail({ id: cohort.id });
      expect(after.status).toBe(CohortStatus.ONGOING);
    });
  });

  describe('수료 → 단계 제안', () => {
    async function setup() {
      const churchId = await newChurch(dataSource);
      const newcomer = await status(churchId, '새가족', 1);
      const trainee = await status(churchId, '훈련생', 3);
      const worker = await status(churchId, '사역자', 5);
      const { id: courseId } = await course(churchId, { completionStatusId: trainee.id });
      const cohort = await cohorts.create(churchId, { courseId, name: '1기', startDate: '2026-03-01', sessionCount: 1 });

      const done = await member(churchId, '수료·아래단계', newcomer.id);
      const already = await member(churchId, '수료·이미위', worker.id);
      const studying = await member(churchId, '수강중', newcomer.id);
      await enrollments.enroll(churchId, cohort.id, { memberIds: [done.id, already.id, studying.id] });
      const { roster } = await enrollments.detail(churchId, cohort.id);
      for (const row of roster.filter(entry => entry.memberId !== studying.id)) {
        await enrollments.updateStatus(churchId, row.enrollmentId, { status: EnrollmentStatus.COMPLETED, closedAt: '2026-05-31' });
      }
      return { churchId, cohort, trainee, done, already, studying };
    }

    it('수료했고 아직 아래 단계인 사람만 후보다 — 수강 중이거나 이미 위 단계면 빠진다', async () => {
      const { churchId, cohort, trainee, done } = await setup();

      const result = await promotions.forCohort(churchId, cohort.id);

      expect(result.target).toEqual({ id: trainee.id, name: '훈련생' });
      expect(result.candidates.map(c => [c.memberId, c.completedAt])).toEqual([[done.id, '2026-05-31']]);
    });

    it('올리면 수료일로 이력을 남기고, 다시 눌러도 이미 올라간 사람은 건너뛴다(내리지 않는다)', async () => {
      const { churchId, cohort, trainee, done, already } = await setup();

      expect(await promotions.apply(churchId, cohort.id, [done.id, already.id])).toEqual({ promoted: 1, skipped: 1 });
      expect(await promotions.apply(churchId, cohort.id, [done.id])).toEqual({ promoted: 0, skipped: 1 });

      const promoted = await dataSource.getRepository(MemberEntity).findOneByOrFail({ id: done.id });
      expect(promoted.statusId).toBe(trainee.id);
      const open = await dataSource.getRepository(MemberStatusHistoryEntity).findOneByOrFail({ memberId: done.id, statusId: trainee.id });
      expect([open.startDate, open.endDate, open.reason]).toEqual(['2026-05-31', null, '제자훈련 1기 수료']);
      expect((await promotions.forCohort(churchId, cohort.id)).candidates).toEqual([]);
    });

    it('넘긴 제안은 다시 뜨지 않는다', async () => {
      const { churchId, cohort, done } = await setup();

      await promotions.dismiss(churchId, cohort.id, [done.id]);

      expect((await promotions.forCohort(churchId, cohort.id)).candidates).toEqual([]);
    });
  });
});
