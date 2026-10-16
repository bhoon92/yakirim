import { DataSource } from 'typeorm';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { ResidentPhase } from '@src/database/entities/resident-status.entity';
import { AffiliationService } from '@src/module/affiliation/affiliation.service';
import { MemberStatusHistoryService } from '@src/module/member/member-status-history.service';
import { MemberPositionService } from '@src/module/position/member-position.service';
import { ShepherdService } from '@src/module/shepherd/shepherd.service';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { ResidentDutyService } from './resident-duty.service';
import { ResidentStatusService } from './resident-status.service';
import { ResidentService } from './resident.service';

/** 성도와 간사는 2트랙 — 간사는 진입 구간(지원 → 면담 → 과정)을 거쳐 헌신·입주로 들어온다 (2026-10-16 사용자). */
describe('간사 트랙 (실제 Postgres)', () => {
  let dataSource: DataSource;
  const statuses = new ResidentStatusService();
  const residents = new ResidentService(
    new MemberStatusHistoryService(),
    new AffiliationService(),
    new MemberPositionService(),
    new ResidentDutyService(),
    new ShepherdService()
  );

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function setup() {
    const churchId = await newChurch(dataSource);
    const apply = await statuses.create(churchId, { name: '지원', phase: ResidentPhase.PREPARING, sortOrder: 0 });
    const interview = await statuses.create(churchId, { name: '면담', phase: ResidentPhase.PREPARING, sortOrder: 1 });
    const active = await statuses.create(churchId, { name: '활동', phase: ResidentPhase.RESIDENT, sortOrder: 2 });
    const left = await statuses.create(churchId, { name: '퇴소', phase: ResidentPhase.LEFT, sortOrder: 3 });
    const memberStatus = await dataSource.getRepository(MemberStatusEntity).save({ churchId, name: '정착', sortOrder: 0 });
    const person = async (name: string) =>
      dataSource
        .getRepository(MemberEntity)
        .save(dataSource.getRepository(MemberEntity).create({ churchId, name, statusId: memberStatus.id }));
    return { churchId, apply, interview, active, left, person };
  }

  it('구간에 따라 집계(countsAsActive)가 맞춰진다 — 예전처럼 countsAsActive 만 보내도 구간이 따라온다', async () => {
    const { churchId, apply, active, left } = await setup();
    expect([apply.countsAsActive, active.countsAsActive, left.countsAsActive]).toEqual([false, true, false]);

    // 예전 클라이언트: 진입 상태에 countsAsActive=false 를 보내도 진입 구간에 남는다
    expect((await statuses.update(churchId, apply.id, { countsAsActive: false })).phase).toBe(ResidentPhase.PREPARING);
    // 이름만 바꾸면 구간은 그대로
    expect((await statuses.update(churchId, apply.id, { name: '지원서 접수' })).phase).toBe(ResidentPhase.PREPARING);
    // countsAsActive=true 면 간사 구간으로
    const moved = await statuses.update(churchId, left.id, { countsAsActive: true });
    expect([moved.phase, moved.countsAsActive]).toEqual([ResidentPhase.RESIDENT, true]);
  });

  it('진입 구간에서 간사 구간으로 옮기면 헌신일·입주일이 그날로 채워지고, 이미 적은 날짜는 그대로', async () => {
    const { churchId, apply, interview, active, person } = await setup();
    const kim = await person('김지원');
    const lee = await person('이지원');
    const a = await residents.create(churchId, 1, { memberId: kim.id, statusId: apply.id });
    const b = await residents.create(churchId, 1, { memberId: lee.id, statusId: apply.id, joinedAt: '2026-03-01' });

    await residents.update(churchId, a.id, 1, { statusId: interview.id, statusDate: '2026-09-01' });
    let profile = await residents.update(churchId, a.id, 1, { statusId: active.id, statusDate: '2026-10-01' });
    expect([profile.committedAt, profile.joinedAt, profile.leftAt]).toEqual(['2026-10-01', '2026-10-01', null]);

    profile = await residents.update(churchId, b.id, 1, { statusId: active.id, statusDate: '2026-10-05' });
    expect([profile.committedAt, profile.joinedAt]).toEqual(['2026-10-05', '2026-03-01']);
  });

  it('진입 준비 중인 사람은 간사 인원에 들어가지 않고 따로 센다', async () => {
    const { churchId, apply, interview, active, left, person } = await setup();
    for (const [name, statusId] of [
      ['지원1', apply.id],
      ['면담1', interview.id],
      ['활동1', active.id],
      ['퇴소1', left.id],
    ] as const) {
      await residents.create(churchId, 1, { memberId: (await person(name)).id, statusId });
    }

    const summary = await residents.summary(churchId);
    expect([summary.active, summary.preparing]).toEqual([1, 2]);
    expect((await residents.list(churchId, { scope: 'active' })).map(item => item.memberName)).toEqual(['활동1']);
    expect((await residents.list(churchId, {})).find(item => item.memberName === '면담1')?.statusPhase).toBe(ResidentPhase.PREPARING);
  });
});
