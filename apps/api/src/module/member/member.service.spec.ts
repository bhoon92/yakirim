import { DataSource } from 'typeorm';
import { addDays, todayString } from '@src/common/date';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { AffiliationService } from '@src/module/affiliation/affiliation.service';
import { MemberPositionService } from '@src/module/position/member-position.service';
import { ShepherdService } from '@src/module/shepherd/shepherd.service';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { MemberStatusHistoryService } from './member-status-history.service';
import { MemberService } from './member.service';

describe('MemberService.pipelineBoard (실제 Postgres)', () => {
  let dataSource: DataSource;
  const history = new MemberStatusHistoryService();
  const members = new MemberService(new AffiliationService(), new MemberPositionService(), history, new ShepherdService());

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function setup() {
    const churchId = await newChurch(dataSource);
    const statuses = dataSource.getRepository(MemberStatusEntity);
    const visit = await statuses.save(statuses.create({ churchId, name: '방문', sortOrder: 0, stallsAfterDays: 30 }));
    const newcomer = await statuses.save(statuses.create({ churchId, name: '새가족', sortOrder: 1, stallsAfterDays: 90 }));
    const sent = await statuses.save(statuses.create({ churchId, name: '파송', sortOrder: 9, stallsAfterDays: null }));
    const hiddenEmpty = await statuses.save(statuses.create({ churchId, name: '안 쓰는 상태', sortOrder: 5, isActive: false }));
    return { churchId, visit, newcomer, sent, hiddenEmpty };
  }

  async function person(churchId: number, name: string, statusId: number, daysAgo: number) {
    const repo = dataSource.getRepository(MemberEntity);
    const member = await repo.save(repo.create({ churchId, name, statusId }));
    await history.record(dataSource.manager, churchId, member.id, statusId, { date: addDays(todayString(), -daysAgo) });
    return member;
  }

  it('재적상태 순서대로 칸을 만들고, 비어 있는 숨김 상태는 뺀다', async () => {
    const { churchId } = await setup();
    const board = await members.pipelineBoard(churchId);
    expect(board.map(column => column.name)).toEqual(['방문', '새가족', '파송']);
  });

  it('카드는 오래 머문 순, 정체 표시와 칸별 집계', async () => {
    const { churchId, visit, sent } = await setup();
    await person(churchId, '10일', visit.id, 10);
    await person(churchId, '45일', visit.id, 45);
    await person(churchId, '딱30일', visit.id, 30);
    await person(churchId, '파송400일', sent.id, 400);
    const deleted = await person(churchId, '삭제됨', visit.id, 100);
    await dataSource.getRepository(MemberEntity).softDelete({ id: deleted.id });

    const [visitColumn, , sentColumn] = await members.pipelineBoard(churchId);

    expect(visitColumn.members.map(card => [card.name, card.days, card.stalled])).toEqual([
      ['45일', 45, true],
      ['딱30일', 30, true],
      ['10일', 10, false],
    ]);
    expect([visitColumn.count, visitColumn.stalledCount]).toEqual([3, 2]);
    // 기준일수가 없는 단계(도착점)는 오래 있어도 정체가 아니다
    expect(sentColumn.members.map(card => card.stalled)).toEqual([false]);
  });

  it('정체 카드는 대시보드 "정체된 사람"(listStalled) 과 같은 사람들이다', async () => {
    const { churchId, visit, newcomer } = await setup();
    await person(churchId, '방문30', visit.id, 30);
    await person(churchId, '방문29', visit.id, 29);
    await person(churchId, '새가족90', newcomer.id, 90);
    await person(churchId, '새가족89', newcomer.id, 89);

    const fromBoard = (await members.pipelineBoard(churchId))
      .flatMap(column => column.members)
      .filter(card => card.stalled)
      .map(card => card.name)
      .sort();
    const fromDashboard = (await history.listStalled(churchId)).map(row => row.memberName).sort();

    expect(fromBoard).toEqual(['방문30', '새가족90']);
    expect(fromBoard).toEqual(fromDashboard);
  });

  it('카드를 옮기는 것(교인 수정 statusId)은 이력을 남기고 새 칸에서 0일부터 센다', async () => {
    const { churchId, visit, newcomer } = await setup();
    const moving = await person(churchId, '옮길 사람', visit.id, 40);

    await members.update(churchId, moving.id, { statusId: newcomer.id });

    const board = await members.pipelineBoard(churchId);
    const card = board.find(column => column.statusId === newcomer.id)!.members[0];
    expect([card.name, card.days, card.stalled]).toEqual(['옮길 사람', 0, false]);
    expect(board.find(column => column.statusId === visit.id)!.count).toBe(0);
    expect((await history.listFor(churchId, moving.id)).map(period => period.statusName)).toEqual(['방문', '새가족']);
  });
});
