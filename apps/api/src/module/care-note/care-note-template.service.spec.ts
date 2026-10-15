import { DataSource, QueryFailedError } from 'typeorm';
import { CareNoteTypeEntity } from '@src/database/entities/care-note-type.entity';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { CareNoteTemplateService } from './care-note-template.service';

describe('CareNoteTemplateService (실제 Postgres)', () => {
  let dataSource: DataSource;
  const templates = new CareNoteTemplateService();

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  it('저장하면 앞뒤 공백을 지우고 빈 칸은 null, 만든 순서대로', async () => {
    const churchId = await newChurch(dataSource);
    const type = await dataSource.getRepository(CareNoteTypeEntity).save({ churchId, name: '심방', sortOrder: 0 });
    await templates.create(churchId, {
      name: ' 새가족 첫 심방 ',
      typeId: type.id,
      content: ' 1. 교회에 오게 된 계기\n2. 가족 ',
      prayerRequest: '  ',
    });
    await templates.create(churchId, { name: '병문안', content: '상태:' });

    const list = await templates.list(churchId);
    expect(list.map(t => [t.name, t.typeId, t.content, t.prayerRequest, t.sortOrder])).toEqual([
      ['새가족 첫 심방', type.id, '1. 교회에 오게 된 계기\n2. 가족', null, 0],
      ['병문안', null, '상태:', null, 1],
    ]);
  });

  it('다른 교회의 기록 종류는 쓸 수 없다', async () => {
    const other = await newChurch(dataSource);
    const foreign = await dataSource.getRepository(CareNoteTypeEntity).save({ churchId: other, name: '심방', sortOrder: 0 });
    await expect(templates.create(await newChurch(dataSource), { name: '양식', typeId: foreign.id, content: '본문' })).rejects.toThrow(
      '기록 종류를 찾을 수 없습니다.'
    );
  });

  it('같은 이름은 막고(→ 409), 지우면 다시 쓸 수 있다', async () => {
    const churchId = await newChurch(dataSource);
    const first = await templates.create(churchId, { name: '병문안', content: '상태:' });
    await expect(templates.create(churchId, { name: '병문안', content: '다른 틀' })).rejects.toBeInstanceOf(QueryFailedError);
    await templates.remove(churchId, first.id);
    await expect(templates.create(churchId, { name: '병문안', content: '다른 틀' })).resolves.toMatchObject({ content: '다른 틀' });
  });
});
