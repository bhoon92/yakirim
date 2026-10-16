import { Workbook } from 'exceljs';
import { DataSource } from 'typeorm';
import { ChurchEntity } from '@src/database/entities/church.entity';
import { FellowshipTableEntity } from '@src/database/entities/fellowship-table.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { MissionaryStageEntity } from '@src/database/entities/missionary-stage.entity';
import { ResidentProfileEntity } from '@src/database/entities/resident-profile.entity';
import { ResidentStatusEntity } from '@src/database/entities/resident-status.entity';
import { AffiliationService } from '@src/module/affiliation/affiliation.service';
import { BudgetService } from '@src/module/finance/budget.service';
import { OfferingService } from '@src/module/finance/offering.service';
import { TransactionService } from '@src/module/finance/transaction.service';
import { MemberStatusHistoryService } from '@src/module/member/member-status-history.service';
import { MemberService } from '@src/module/member/member.service';
import { MissionaryService } from '@src/module/missionary/missionary.service';
import { MemberPositionService } from '@src/module/position/member-position.service';
import { ResidentDutyService } from '@src/module/resident/resident-duty.service';
import { ResidentService } from '@src/module/resident/resident.service';
import { ShepherdService } from '@src/module/shepherd/shepherd.service';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { ExportService, sundaysOf } from './export.service';

/** xlsx 버퍼 → [머리글, ...행] (셀 값 그대로). */
async function readSheet(buffer: Buffer): Promise<unknown[][]> {
  const wb = new Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const rows: unknown[][] = [];
  wb.worksheets[0].eachRow(row => rows.push((row.values as unknown[]).slice(1)));
  return rows;
}

describe('ExportService — 간사·선교사 명부·출석부 (실제 Postgres)', () => {
  let dataSource: DataSource;
  const history = new MemberStatusHistoryService();
  const transactions = new TransactionService();
  const members = new MemberService(new AffiliationService(), new MemberPositionService(), history, new ShepherdService());
  const residents = new ResidentService(
    history,
    new AffiliationService(),
    new MemberPositionService(),
    new ResidentDutyService(),
    new ShepherdService()
  );
  const missionaries = new MissionaryService(history);
  const exports = new ExportService(
    new OfferingService(),
    transactions,
    new BudgetService(transactions),
    members,
    residents,
    missionaries,
    new AffiliationService()
  );

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function person(churchId: number, name: string) {
    const statuses = dataSource.getRepository(MemberStatusEntity);
    const status =
      (await statuses.findOne({ where: { churchId } })) ?? (await statuses.save(statuses.create({ churchId, name: '정착', sortOrder: 0 })));
    const repo = dataSource.getRepository(MemberEntity);
    return repo.save(repo.create({ churchId, name, statusId: status.id, phone: '010-0000-0000' }));
  }

  it('간사 명부: 퇴소한 사람도 포함하고 "현재 간사" 로 구분한다', async () => {
    const churchId = await newChurch(dataSource);
    const statuses = dataSource.getRepository(ResidentStatusEntity);
    const living = await statuses.save(statuses.create({ churchId, name: '입주', sortOrder: 0, countsAsActive: true }));
    const left = await statuses.save(statuses.create({ churchId, name: '퇴소', sortOrder: 1, countsAsActive: false }));
    const profiles = dataSource.getRepository(ResidentProfileEntity);
    const kim = await person(churchId, '김간사');
    const lee = await person(churchId, '이간사');
    await profiles.save(profiles.create({ churchId, memberId: kim.id, statusId: living.id, joinedAt: '2025-03-01', note: '1층' }));
    await profiles.save(profiles.create({ churchId, memberId: lee.id, statusId: left.id, joinedAt: '2023-03-01', leftAt: '2026-02-28' }));

    const [header, ...rows] = await readSheet(await exports.residents_xlsx(churchId));

    expect(header).toEqual(expect.arrayContaining(['이름', '상태', '현재 간사', '입주일', '퇴소일', '하우스', '훈련', '맡은 성도']));
    const col = (name: string) => header.indexOf(name);
    expect(rows.map(row => [row[col('이름')], row[col('상태')], row[col('현재 간사')], row[col('퇴소일')]])).toEqual([
      ['김간사', '입주', '예', ''],
      ['이간사', '퇴소', '아니오', '2026-02-28'],
    ]);
  });

  it('선교사 명부: "현재 파송" 은 단계의 countsAsActive, 단계 없으면 "단계 미지정"', async () => {
    const churchId = await newChurch(dataSource);
    const stages = dataSource.getRepository(MissionaryStageEntity);
    const field = await stages.save(stages.create({ churchId, name: '현장', sortOrder: 1, countsAsActive: true }));
    const park = await person(churchId, '박선교사');
    const choi = await person(churchId, '최후보');
    await missionaries.create(churchId, 1, { memberId: park.id, stageId: field.id, country: '캄보디아', commissionedAt: '2026-04-05' });
    await missionaries.create(churchId, 1, { memberId: choi.id });

    const [header, ...rows] = await readSheet(await exports.missionaries_xlsx(churchId));

    const col = (name: string) => header.indexOf(name);
    expect(rows.map(row => [row[col('이름')], row[col('단계')], row[col('현재 파송')], row[col('파송 국가')], row[col('파송일')]])).toEqual(
      [
        ['박선교사', '현장', '예', '캄보디아', '2026-04-05'],
        ['최후보', '단계 미지정', '아니오', '', ''],
      ]
    );
  });

  it('출석부: 그 달 주일마다 칸, 출석 명단 대상만 이름순, 맨 아래 빈 줄과 출석 인원 줄', async () => {
    const churchId = await newChurch(dataSource);
    await dataSource.getRepository(ChurchEntity).update(churchId, { name: '테스트교회' });
    const statuses = dataSource.getRepository(MemberStatusEntity);
    const settled = await statuses.save(statuses.create({ churchId, name: '정착', sortOrder: 0 }));
    const moved = await statuses.save(statuses.create({ churchId, name: '이명', sortOrder: 1, countsInRoster: false }));
    const repo = dataSource.getRepository(MemberEntity);
    const [ha] = await repo.save([
      repo.create({ churchId, name: '하성도', statusId: settled.id }),
      repo.create({ churchId, name: '가성도', statusId: settled.id }),
      repo.create({ churchId, name: '나이명', statusId: moved.id }),
    ]);
    const tables = dataSource.getRepository(FellowshipTableEntity);
    const table = await tables.save(tables.create({ churchId, year: 2026, name: '1테이블' }));
    await new AffiliationService().assign('table', churchId, ha.id, { referenceId: table.id });

    const rows = await readSheet(await exports.attendance_sheet_xlsx(churchId, '2026-11'));

    expect(rows[0][0]).toBe('테스트교회 출석부 — 2026년 11월');
    expect(rows[1]).toEqual(['번호', '이름', '테이블', '재적상태', '11/1', '11/8', '11/15', '11/22', '11/29', '비고']);
    expect(rows.slice(2, 4).map(row => [row[0], row[1], row[2], row[3]])).toEqual([
      [1, '가성도', '', '정착'],
      [2, '하성도', '1테이블', '정착'],
    ]);
    expect(rows.flat()).not.toContain('나이명');
    expect(rows.at(-1)?.[1]).toBe('출석 인원');
    expect(rows.length).toBe(2 + 2 + 8 + 1);
  });

  it('출석부: 월 형식이 틀리면 거절한다', async () => {
    const churchId = await newChurch(dataSource);
    await expect(exports.attendance_sheet_xlsx(churchId, '2026-13')).rejects.toThrow('YYYY-MM');
  });
});

describe('sundaysOf', () => {
  it('그 달의 주일만, 월 경계를 넘지 않는다', () => {
    expect(sundaysOf('2026-10')).toEqual(['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
    expect(sundaysOf('2026-02')).toEqual(['2026-02-01', '2026-02-08', '2026-02-15', '2026-02-22']);
  });
});
