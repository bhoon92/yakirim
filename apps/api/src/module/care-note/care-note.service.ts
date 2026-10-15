import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { AccountEntity } from '@src/database/entities/account.entity';
import { CareNoteEntity } from '@src/database/entities/care-note.entity';
import { CareNoteTypeEntity } from '@src/database/entities/care-note-type.entity';
import { MemberEntity } from '@src/database/entities/member.entity';
import { todayString } from '@src/common/date';
import { CreateCareNoteDto } from './dto/create-care-note.dto';
import { UpdateCareNoteDto } from './dto/update-care-note.dto';

export type CareNoteItem = {
  id: number;
  typeId: number;
  /** 기록 종류 이름. 색은 화면에서 typeId 로 정한다. */
  typeName: string | null;
  date: string;
  location: string | null;
  content: string;
  prayerRequest: string | null;
  statusNote: string | null;
  recorderAccountId: number;
  recorderName: string | null;
  createdAt: Date;
};

@Injectable()
export class CareNoteService {
  private repo() {
    return DataSources.instance.getRepository(CareNoteEntity);
  }

  async create(churchId: number, memberId: number, recorderAccountId: number, dto: CreateCareNoteDto): Promise<CareNoteEntity> {
    await this.assertMember(churchId, memberId);
    const typeId = dto.typeId ?? (await this.defaultTypeId(churchId));
    await this.assertType(churchId, typeId);
    const row = this.repo().create({
      churchId,
      memberId,
      recorderAccountId,
      typeId,
      date: dto.date ?? this.today(),
      location: dto.location,
      content: dto.content,
      prayerRequest: dto.prayerRequest,
      statusNote: dto.statusNote,
    });
    return this.repo().save(row);
  }

  /** 한 교인의 양육 기록 timeline (기록일 내림차순). 작성자 이름까지 join. */
  async listForMember(churchId: number, memberId: number): Promise<CareNoteItem[]> {
    await this.assertMember(churchId, memberId);
    const rows = await this.repo().find({
      where: { churchId, memberId },
      order: { date: 'DESC', id: 'DESC' },
    });
    if (rows.length === 0) return [];

    const accountIds = Array.from(new Set(rows.map(note => note.recorderAccountId)));
    const [accounts, types] = await Promise.all([
      DataSources.instance.getRepository(AccountEntity).find({ where: accountIds.map(id => ({ id })) }),
      DataSources.instance.getRepository(CareNoteTypeEntity).find({ where: { churchId } }),
    ]);
    const nameMap = new Map(accounts.map(account => [account.id, account.name]));
    const typeNameMap = new Map(types.map(type => [type.id, type.name]));

    return rows.map(note => ({
      id: note.id,
      typeId: note.typeId,
      typeName: typeNameMap.get(note.typeId) ?? null,
      date: note.date,
      location: note.location ?? null,
      content: note.content,
      prayerRequest: note.prayerRequest ?? null,
      statusNote: note.statusNote ?? null,
      recorderAccountId: note.recorderAccountId,
      recorderName: nameMap.get(note.recorderAccountId) ?? null,
      createdAt: note.createdAt,
    }));
  }

  async update(churchId: number, memberId: number, id: number, dto: UpdateCareNoteDto): Promise<CareNoteEntity> {
    const row = await this.repo().findOne({ where: { id, churchId, memberId } });
    if (!row) throw new NotFoundException('양육 기록을 찾을 수 없습니다.');
    await this.repo().update({ id, churchId, memberId }, dto);
    const updated = await this.repo().findOne({ where: { id, churchId, memberId } });
    return updated!;
  }

  async remove(churchId: number, memberId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId, memberId });
    if (!result.affected) throw new NotFoundException('양육 기록을 찾을 수 없습니다.');
  }

  /** 종류를 안 보내면 목록 첫 항목(보통 '심방'). 교회가 순서를 바꾸면 기본값도 따라간다. */
  private async defaultTypeId(churchId: number): Promise<number> {
    const type = await DataSources.instance
      .getRepository(CareNoteTypeEntity)
      .findOne({ where: { churchId, isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
    if (!type) throw new NotFoundException('양육기록 종류가 설정되지 않았습니다.');
    return type.id;
  }

  private async assertType(churchId: number, typeId: number): Promise<void> {
    const type = await DataSources.instance.getRepository(CareNoteTypeEntity).findOne({ where: { id: typeId, churchId } });
    if (!type) throw new NotFoundException('양육기록 종류를 찾을 수 없습니다.');
  }

  private async assertMember(churchId: number, memberId: number): Promise<void> {
    const member = await DataSources.instance.getRepository(MemberEntity).findOne({ where: { id: memberId, churchId } });
    if (!member) throw new NotFoundException('Member not found');
  }

  private today(): string {
    // toISOString 은 UTC 라 TZ=Asia/Seoul 에서 새벽 0~9시에 어제 날짜가 된다.
    return todayString();
  }
}
