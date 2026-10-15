import { DataSource, QueryFailedError } from 'typeorm';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { MemberViewService } from './member-view.service';

describe('MemberViewService (실제 Postgres)', () => {
  let dataSource: DataSource;
  const views = new MemberViewService();

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  it('빈 값은 빼고 저장하고, 만든 순서대로 돌려준다', async () => {
    const churchId = await newChurch(dataSource);
    await views.create(churchId, 1, { name: ' 담당 없는 새가족 ', filters: { statusId: 3, shepherd: 'none', q: '  ', stalled: false } });
    await views.create(churchId, 1, { name: '정체', filters: { stalled: true } });

    const list = await views.list(churchId);
    expect(list.map(view => [view.name, view.filters, view.sortOrder])).toEqual([
      ['담당 없는 새가족', { statusId: 3, shepherd: 'none' }, 0],
      ['정체', { stalled: true }, 1],
    ]);
  });

  it('소속은 종류와 id 가 둘 다 있어야 남는다', async () => {
    const churchId = await newChurch(dataSource);
    const view = await views.create(churchId, 1, {
      name: '1목장',
      filters: { affiliationKind: 'smallGroup', affiliationId: 7, statusId: 2 },
    });
    expect(view.filters).toEqual({ affiliationKind: 'smallGroup', affiliationId: 7, statusId: 2 });
    await expect(views.create(churchId, 1, { name: '소속 반쪽', filters: { affiliationKind: 'smallGroup' } })).rejects.toThrow(
      '저장할 필터가 없습니다.'
    );
  });

  it('같은 교회에서 같은 이름은 막고(→ 409), 지우면 그 이름을 다시 쓸 수 있다', async () => {
    const churchId = await newChurch(dataSource);
    const first = await views.create(churchId, 1, { name: '정체', filters: { stalled: true } });
    await expect(views.create(churchId, 1, { name: '정체', filters: { statusId: 1 } })).rejects.toBeInstanceOf(QueryFailedError);

    await views.remove(churchId, first.id);
    await expect(views.create(churchId, 1, { name: '정체', filters: { statusId: 1 } })).resolves.toMatchObject({ name: '정체' });
    // 다른 교회는 같은 이름을 써도 된다
    await expect(views.create(await newChurch(dataSource), 1, { name: '정체', filters: { stalled: true } })).resolves.toBeTruthy();
  });

  it('다른 교회의 보기는 지울 수 없다', async () => {
    const mine = await newChurch(dataSource);
    const view = await views.create(mine, 1, { name: '정체', filters: { stalled: true } });
    await expect(views.remove(await newChurch(dataSource), view.id)).rejects.toThrow('보기를 찾을 수 없습니다.');
  });
});
