import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { CareNoteTemplateEntity } from '@src/database/entities/care-note-template.entity';
import { CareNoteTypeEntity } from '@src/database/entities/care-note-type.entity';
import { CreateCareNoteTemplateDto } from './dto/care-note-template.dto';

@Injectable()
export class CareNoteTemplateService {
  private repo() {
    return DataSources.instance.getRepository(CareNoteTemplateEntity);
  }

  list(churchId: number): Promise<CareNoteTemplateEntity[]> {
    return this.repo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  /** 이름이 겹치면 DB 부분 유니크 인덱스가 막고 예외 필터가 409 로 바꾼다. */
  async create(churchId: number, dto: CreateCareNoteTemplateDto): Promise<CareNoteTemplateEntity> {
    const name = dto.name.trim();
    const content = dto.content.trim();
    if (!name) throw new BadRequestException('양식 이름을 입력하세요.');
    if (!content) throw new BadRequestException('본문을 입력하세요.');
    if (dto.typeId) {
      const type = await DataSources.instance.getRepository(CareNoteTypeEntity).findOne({ where: { id: dto.typeId, churchId } });
      if (!type) throw new NotFoundException('기록 종류를 찾을 수 없습니다.');
    }
    const last = await this.repo().findOne({ where: { churchId }, order: { sortOrder: 'DESC' } });
    return this.repo().save(
      this.repo().create({
        churchId,
        name,
        typeId: dto.typeId ?? null,
        content,
        prayerRequest: dto.prayerRequest?.trim() || null,
        statusNote: dto.statusNote?.trim() || null,
        sortOrder: last ? last.sortOrder + 1 : 0,
      })
    );
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('양식을 찾을 수 없습니다.');
  }
}
