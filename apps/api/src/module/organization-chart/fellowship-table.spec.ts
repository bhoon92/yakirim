import { DataSource } from 'typeorm';
import { FellowshipTableEntity } from '@src/database/entities/fellowship-table.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { SmallGroupEntity } from '@src/database/entities/small-group.entity';
import { AffiliationService } from '@src/module/affiliation/affiliation.service';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { OrganizationChartService } from './organization-chart.service';

/** 테이블(예배 후 나눔) — 공동체(하우스)와 별개인 네 번째 소속. 리더는 일반 성도가 맡는다. */
describe('테이블 소속 (실제 Postgres)', () => {
  let dataSource: DataSource;
  const affiliations = new AffiliationService();
  const chart = new OrganizationChartService();

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function setup() {
    const churchId = await newChurch(dataSource);
    const statuses = dataSource.getRepository(MemberStatusEntity);
    const status = await statuses.save(statuses.create({ churchId, name: '정착', sortOrder: 0 }));
    const members = dataSource.getRepository(MemberEntity);
    const [kim, lee, park] = await members.save(
      ['김리더', '이성도', '박성도'].map(name => members.create({ churchId, name, statusId: status.id }))
    );
    const tables = dataSource.getRepository(FellowshipTableEntity);
    const table = await tables.save(tables.create({ churchId, year: 2026, name: '1테이블' }));
    const houses = dataSource.getRepository(SmallGroupEntity);
    const house = await houses.save(houses.create({ churchId, year: 2026, name: '1하우스' }));
    return { churchId, kim, lee, park, table, house };
  }

  it('리더와 성도로 나뉘어 조직도에 나오고, 하우스와 섞이지 않는다', async () => {
    const { churchId, kim, lee, park, table, house } = await setup();
    await affiliations.assign('table', churchId, kim.id, { referenceId: table.id, isLeader: true, roleLabel: '테이블 리더' });
    await affiliations.assign('table', churchId, lee.id, { referenceId: table.id });
    await affiliations.assign('table', churchId, park.id, { referenceId: table.id });
    await affiliations.assign('smallGroup', churchId, park.id, { referenceId: house.id });

    const tree = await chart.tree(churchId, 2026);

    expect(tree.table).toEqual([
      expect.objectContaining({
        referenceName: '1테이블',
        leader: [expect.objectContaining({ name: '김리더', roleLabel: '테이블 리더' })],
        member: [expect.objectContaining({ name: '박성도' }), expect.objectContaining({ name: '이성도' })],
        total: 3,
      }),
    ]);
    expect(tree.smallGroup[0].total).toBe(1);

    const tags = await affiliations.currentForMembers(churchId, [park.id]);
    expect(tags.get(park.id)).toEqual(
      expect.objectContaining({
        tables: [{ id: table.id, name: '1테이블', isLeader: false }],
        smallGroups: [{ id: house.id, name: '1하우스', isLeader: false }],
      })
    );
    expect((await affiliations.listForMember(churchId, kim.id)).tables).toHaveLength(1);
  });

  it('같은 테이블에 두 번 배정하면 409, 종료하면 조직도에서 빠진다', async () => {
    const { churchId, lee, table } = await setup();
    await affiliations.assign('table', churchId, lee.id, { referenceId: table.id });
    await expect(affiliations.assign('table', churchId, lee.id, { referenceId: table.id })).rejects.toThrow();

    await affiliations.end('table', churchId, lee.id, table.id);

    expect((await chart.tree(churchId, 2026)).table[0].total).toBe(0);
    expect(await affiliations.memberIdsFor('table', churchId, table.id)).toEqual([]);
  });
});
