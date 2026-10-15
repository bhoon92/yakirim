import { DataSource } from 'typeorm';
import { addDays, todayString } from '@src/common/date';
import { MemberStatusHistoryEntity } from '@src/database/entities/member-status-history.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { AffiliationService } from '@src/module/affiliation/affiliation.service';
import { MemberPositionService } from '@src/module/position/member-position.service';
import { ShepherdService } from '@src/module/shepherd/shepherd.service';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { MemberStatusHistoryService } from './member-status-history.service';
import { MemberService } from './member.service';

describe('MemberStatusHistoryService (실제 Postgres)', () => {
  let dataSource: DataSource;
  const history = new MemberStatusHistoryService();
  const members = new MemberService(new AffiliationService(), new MemberPositionService(), history, new ShepherdService());

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function status(churchId: number, name: string, sortOrder: number, stallsAfterDays: number | null) {
    const repo = dataSource.getRepository(MemberStatusEntity);
    return repo.save(repo.create({ churchId, name, sortOrder, stallsAfterDays }));
  }

  /** 교인 + "since 부터 지금까지 이 상태" 인 열린 구간. */
  async function memberIn(churchId: number, name: string, statusId: number, since: string) {
    const repo = dataSource.getRepository(MemberEntity);
    const member = await repo.save(repo.create({ churchId, name, statusId }));
    await history.record(dataSource.manager, churchId, member.id, statusId, { date: since });
    return member;
  }

  describe('record', () => {
    it('같은 상태로 다시 기록하면 아무것도 하지 않는다', async () => {
      const churchId = await newChurch(dataSource);
      const visit = await status(churchId, '방문', 0, 30);
      const member = await memberIn(churchId, '가', visit.id, '2026-01-01');

      await history.record(dataSource.manager, churchId, member.id, visit.id, { date: '2026-02-01' });

      const rows = await dataSource.getRepository(MemberStatusHistoryEntity).find({ where: { churchId, memberId: member.id } });
      expect(rows).toHaveLength(1);
    });

    it('상태가 바뀌면 열린 구간을 그 날짜로 닫고 새 구간을 연다 (부분 유니크 인덱스 때문에 닫는 게 먼저)', async () => {
      const churchId = await newChurch(dataSource);
      const visit = await status(churchId, '방문', 0, 30);
      const newcomer = await status(churchId, '새가족', 1, 90);
      const member = await memberIn(churchId, '가', visit.id, '2026-01-01');

      await history.record(dataSource.manager, churchId, member.id, newcomer.id, { date: '2026-02-01', reason: '등록' });

      const periods = await history.listFor(churchId, member.id);
      expect(periods.map(p => [p.statusName, p.startDate, p.endDate])).toEqual([
        ['방문', '2026-01-01', '2026-02-01'],
        ['새가족', '2026-02-01', null],
      ]);
      expect(periods[0].days).toBe(31);
    });
  });

  describe('정체 판정', () => {
    it('기준일수를 딱 채운 날부터 정체다 — 하루 모자라면 아니다', async () => {
      const churchId = await newChurch(dataSource);
      const visit = await status(churchId, '방문', 0, 30);
      const today = todayString();
      await memberIn(churchId, '딱30일', visit.id, addDays(today, -30));
      await memberIn(churchId, '29일', visit.id, addDays(today, -29));

      const stalled = await history.listStalled(churchId);
      expect(stalled.map(s => [s.memberName, s.days, s.threshold])).toEqual([['딱30일', 30, 30]]);
    });

    it('기준일수가 없는 상태(도착점·이탈), 이미 지나간 구간, 삭제된 교인은 정체가 아니다', async () => {
      const churchId = await newChurch(dataSource);
      const visit = await status(churchId, '방문', 0, 30);
      const settled = await status(churchId, '파송', 9, null);
      const longAgo = addDays(todayString(), -400);

      await memberIn(churchId, '도착점', settled.id, longAgo);
      const moved = await memberIn(churchId, '옮겨감', visit.id, longAgo);
      await history.record(dataSource.manager, churchId, moved.id, settled.id, { date: addDays(todayString(), -1) });
      const deleted = await memberIn(churchId, '삭제됨', visit.id, longAgo);
      await dataSource.getRepository(MemberEntity).softDelete({ id: deleted.id });

      expect(await history.listStalled(churchId)).toEqual([]);
    });

    it('오래 머문 순으로 준다', async () => {
      const churchId = await newChurch(dataSource);
      const visit = await status(churchId, '방문', 0, 30);
      await memberIn(churchId, '40일', visit.id, addDays(todayString(), -40));
      await memberIn(churchId, '100일', visit.id, addDays(todayString(), -100));

      expect((await history.listStalled(churchId)).map(s => s.memberName)).toEqual(['100일', '40일']);
    });

    // HANDOFF §4.3: 판정이 두 곳에 있었고 한쪽만 고치면 대시보드 숫자와 목록 인원이 어긋났다.
    it('대시보드(listStalled)와 교인 목록 stalled 필터가 같은 사람들을 준다', async () => {
      const churchId = await newChurch(dataSource);
      const visit = await status(churchId, '방문', 0, 30);
      const newcomer = await status(churchId, '새가족', 1, 90);
      const settled = await status(churchId, '파송', 9, null);
      const today = todayString();
      const cases: [string, number, number][] = [
        ['방문30', visit.id, 30],
        ['방문29', visit.id, 29],
        ['새가족90', newcomer.id, 90],
        ['새가족89', newcomer.id, 89],
        ['파송500', settled.id, 500],
      ];
      for (const [name, statusId, days] of cases) await memberIn(churchId, name, statusId, addDays(today, -days));

      const fromDashboard = (await history.listStalled(churchId)).map(s => s.memberName).sort();
      const fromList = (await members.list(churchId, { stalled: true, pageSize: 100 })).items.map(m => m.name).sort();

      expect(fromDashboard).toEqual(['방문30', '새가족90']);
      expect(fromList).toEqual(fromDashboard);
    });
  });
});
