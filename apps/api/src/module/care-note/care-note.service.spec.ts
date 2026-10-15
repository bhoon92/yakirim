import { DataSource } from 'typeorm';
import { CareNoteTypeEntity } from '@src/database/entities/care-note-type.entity';
import { MemberStatusEntity } from '@src/database/entities/member-status.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { newChurch, setupTestDb } from '@src/test-support/test-db';
import { CareNoteService } from './care-note.service';

describe('CareNoteService — @멘션 (실제 Postgres)', () => {
  let dataSource: DataSource;
  const notes = new CareNoteService();

  beforeAll(async () => {
    dataSource = await setupTestDb();
  });
  afterAll(async () => {
    await dataSource.destroy();
  });

  async function setup() {
    const churchId = await newChurch(dataSource);
    const status = await dataSource.getRepository(MemberStatusEntity).save({ churchId, name: '정착', sortOrder: 0 });
    await dataSource.getRepository(CareNoteTypeEntity).save({ churchId, name: '심방', sortOrder: 0 });
    const members = dataSource.getRepository(MemberEntity);
    const [kim, lee, park] = await members.save(
      ['김성도', '이성도', '박간사'].map(name => members.create({ churchId, name, statusId: status.id }))
    );
    return { churchId, kim, lee, park };
  }

  it('언급한 교인 이름이 기록과 함께 오고, 다른 교회 id 는 저장되지 않는다', async () => {
    const { churchId, kim, lee, park } = await setup();
    const other = await setup();

    await notes.create(churchId, kim.id, 1, {
      content: '@이성도 와 함께 방문. @박간사 가 이어서 연락하기로',
      mentionedMemberIds: [lee.id, park.id, lee.id, other.kim.id],
    });

    const [note] = await notes.listForMember(churchId, kim.id);
    expect(note.mentions).toEqual([
      { id: lee.id, name: '이성도' },
      { id: park.id, name: '박간사' },
    ]);
  });

  it('언급된 사람에게는 백링크로 — 기록 대상 이름과 함께, 자기 자신의 기록은 빼고', async () => {
    const { churchId, kim, lee, park } = await setup();
    await notes.create(churchId, kim.id, 1, { content: '@박간사 동행', mentionedMemberIds: [park.id], date: '2026-10-01' });
    await notes.create(churchId, lee.id, 1, { content: '@박간사 가 맡기로', mentionedMemberIds: [park.id], date: '2026-10-05' });
    await notes.create(churchId, park.id, 1, { content: '본인 기록에 자기 이름', mentionedMemberIds: [park.id] });
    await notes.create(churchId, lee.id, 1, { content: '언급 없음' });

    const backlinks = await notes.listMentioning(churchId, park.id);
    expect(backlinks.map(item => [item.subjectName, item.date, item.content])).toEqual([
      ['이성도', '2026-10-05', '@박간사 가 맡기로'],
      ['김성도', '2026-10-01', '@박간사 동행'],
    ]);
  });

  it('수정하면 언급이 통째로 바뀌고, 기록 대상이 지워지면 백링크도 숨긴다', async () => {
    const { churchId, kim, lee, park } = await setup();
    const note = await notes.create(churchId, kim.id, 1, { content: '@이성도', mentionedMemberIds: [lee.id] });

    await notes.update(churchId, kim.id, note.id, { content: '@박간사', mentionedMemberIds: [park.id] });
    expect(await notes.listMentioning(churchId, lee.id)).toEqual([]);
    expect((await notes.listMentioning(churchId, park.id)).length).toBe(1);

    await dataSource.getRepository(MemberEntity).softDelete({ id: kim.id });
    expect(await notes.listMentioning(churchId, park.id)).toEqual([]);
  });
});
