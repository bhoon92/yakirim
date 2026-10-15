import { Workbook } from 'exceljs';
import { DataSource } from 'typeorm';
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
import { ExportService } from './export.service';

/** xlsx 버퍼 → [머리글, ...행] (셀 값 그대로). */
async function readSheet(buffer: Buffer): Promise<unknown[][]> {
  const wb = new Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const rows: unknown[][] = [];
  wb.worksheets[0].eachRow(row => rows.push((row.values as unknown[]).slice(1)));
  return rows;
}

describe('ExportService — 간사·선교사 명부 (실제 Postgres)', () => {
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
  const exports = new ExportService(new OfferingService(), transactions, new BudgetService(transactions), members, residents, missionaries);

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
});
