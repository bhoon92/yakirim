import { DataSource } from 'typeorm';
import { todayString } from '@src/common/date';
import { MemberStatusHistoryEntity } from '@src/database/entities/member-status-history.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MissionaryProfileEntity } from '@src/database/entities/missionary-profile.entity';
import { MissionaryStageEntity } from '@src/database/entities/missionary-stage.entity';
import { MemberStatusHistoryService } from '@src/module/member/member-status-history.service';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { MissionaryService } from './missionary.service';

const ACCOUNT_ID = 1;

/**
 * 파송 집계 규약 (HANDOFF §4.3): 단계 **이름이 아니라 `countsAsActive` 플래그**가 기준이고,
 * 재적상태 연동은 `member_status.systemKey`(commissioned / worker)로 찾는다.
 */
describe('MissionaryService — countsAsActive 연동 (실제 Postgres)', () => {
  let dataSource: DataSource;
  const history = new MemberStatusHistoryService();
  const missionaries = new MissionaryService(history);

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function setup(options: { withSystemStatuses?: boolean } = {}) {
    const churchId = await newChurch(dataSource);
    const statuses = dataSource.getRepository(MemberStatusEntity);
    const settled = await statuses.save(statuses.create({ churchId, name: '정착', sortOrder: 2 }));
    const withKeys = options.withSystemStatuses ?? true;
    const worker = withKeys ? await statuses.save(statuses.create({ churchId, name: '사역자', sortOrder: 5, systemKey: 'worker' })) : null;
    const commissioned = withKeys
      ? await statuses.save(statuses.create({ churchId, name: '파송', sortOrder: 6, systemKey: 'commissioned', countsInRoster: false }))
      : null;

    const stages = dataSource.getRepository(MissionaryStageEntity);
    // 일부러 "파송"이 아닌 이름 — 이름으로 판단하면 이 테스트가 깨진다
    const preparing = await stages.save(stages.create({ churchId, name: '준비', sortOrder: 0, countsAsActive: false }));
    const field = await stages.save(stages.create({ churchId, name: '현장', sortOrder: 1, countsAsActive: true }));
    const furlough = await stages.save(stages.create({ churchId, name: '안식년', sortOrder: 2, countsAsActive: true }));
    const returned = await stages.save(stages.create({ churchId, name: '귀국', sortOrder: 3, countsAsActive: false }));

    const members = dataSource.getRepository(MemberEntity);
    const person = await members.save(members.create({ churchId, name: '선교사', statusId: settled.id }));
    await history.record(dataSource.manager, churchId, person.id, settled.id, { date: '2026-01-01' });

    return { churchId, settled, worker, commissioned, preparing, field, furlough, returned, person };
  }

  const memberStatus = async (id: number) => (await dataSource.getRepository(MemberEntity).findOneByOrFail({ id })).statusId;
  const profileOf = async (id: number) => dataSource.getRepository(MissionaryProfileEntity).findOneByOrFail({ id });
  const historyOf = async (memberId: number) =>
    dataSource.getRepository(MemberStatusHistoryEntity).find({ where: { memberId }, order: { id: 'ASC' } });

  it('집계 단계로 바로 등록하면 파송일이 오늘이 되고 재적상태가 "파송"으로 바뀐다', async () => {
    const { churchId, commissioned, field, person } = await setup();

    const profile = await missionaries.create(churchId, ACCOUNT_ID, { memberId: person.id, stageId: field.id });

    expect((await profileOf(profile.id)).commissionedAt).toBe(todayString());
    expect(await memberStatus(person.id)).toBe(commissioned!.id);
    expect((await historyOf(person.id)).at(-1)?.reason).toBe('파송 단계 진입 (자동)');
  });

  it('집계 밖 단계로 등록하면 아무것도 바꾸지 않는다', async () => {
    const { churchId, settled, preparing, person } = await setup();

    const profile = await missionaries.create(churchId, ACCOUNT_ID, { memberId: person.id, stageId: preparing.id });

    expect((await profileOf(profile.id)).commissionedAt).toBeNull();
    expect(await memberStatus(person.id)).toBe(settled.id);
  });

  it('기록으로 집계 단계에 들어가면 그 기록 날짜가 파송일, 나오면 "사역자"로 돌아가고 파송일은 남는다', async () => {
    const { churchId, worker, commissioned, preparing, field, returned, person } = await setup();
    const profile = await missionaries.create(churchId, ACCOUNT_ID, { memberId: person.id, stageId: preparing.id });

    await missionaries.addNote(churchId, profile.id, ACCOUNT_ID, { content: '파송예배', stageId: field.id, date: '2026-04-05' });
    expect((await profileOf(profile.id)).commissionedAt).toBe('2026-04-05');
    expect(await memberStatus(person.id)).toBe(commissioned!.id);

    await missionaries.addNote(churchId, profile.id, ACCOUNT_ID, { content: '귀국', stageId: returned.id, date: '2026-09-01' });
    expect(await memberStatus(person.id)).toBe(worker!.id);
    expect((await profileOf(profile.id)).commissionedAt).toBe('2026-04-05');

    // 지난 일을 나중에 기록해도 이력 구간은 기록 날짜를 따른다 (오늘로 남으면 단계 이동 집계가 틀어진다)
    const periods = await history.listFor(churchId, person.id);
    expect(periods.map(p => [p.statusName, p.startDate, p.endDate, p.reason])).toEqual([
      ['정착', '2026-01-01', '2026-04-05', null],
      ['파송', '2026-04-05', '2026-09-01', '파송 단계 진입 (자동)'],
      ['사역자', '2026-09-01', null, '파송 단계 이탈 (자동)'],
    ]);
  });

  it('집계 단계끼리 옮기면(현장 → 안식년) 재적상태·이력을 건드리지 않는다', async () => {
    const { churchId, field, furlough, person } = await setup();
    const profile = await missionaries.create(churchId, ACCOUNT_ID, { memberId: person.id, stageId: field.id });
    const before = await historyOf(person.id);

    await missionaries.update(churchId, profile.id, { stageId: furlough.id });

    expect(await historyOf(person.id)).toHaveLength(before.length);
  });

  it('교회가 systemKey 상태를 지웠으면 재적상태 연동만 조용히 건너뛰고 파송일은 기록한다', async () => {
    const { churchId, settled, field, person } = await setup({ withSystemStatuses: false });

    const profile = await missionaries.create(churchId, ACCOUNT_ID, { memberId: person.id, stageId: field.id });

    expect((await profileOf(profile.id)).commissionedAt).toBe(todayString());
    expect(await memberStatus(person.id)).toBe(settled.id);
  });

  it('"현재 파송" 인원은 요약·목록·대시보드 기준이 모두 같다', async () => {
    const { churchId, settled, preparing, field, furlough, returned } = await setup();
    const members = dataSource.getRepository(MemberEntity);
    for (const [name, stageId] of [
      ['준비', preparing.id],
      ['현장', field.id],
      ['안식년', furlough.id],
      ['귀국', returned.id],
      ['미지정', undefined],
    ] as const) {
      const person = await members.save(members.create({ churchId, name, statusId: settled.id }));
      await missionaries.create(churchId, ACCOUNT_ID, { memberId: person.id, stageId });
    }

    const summary = await missionaries.summary(churchId);
    const activeList = await missionaries.list(churchId, { scope: 'active' });
    const activeStageIds = await missionaries.activeStageIds(churchId);

    expect(summary.active).toBe(2);
    expect(activeList.map(item => item.memberName).sort()).toEqual(['안식년', '현장']);
    expect(activeStageIds.sort()).toEqual([field.id, furlough.id].sort());
    expect(summary.byStage.find(row => row.stageId === null)).toEqual({
      stageId: null,
      name: '단계 미지정',
      count: 1,
      countsAsActive: false,
    });
  });
});
