import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { CalendarEntity } from '@src/database/entities/calendar.entity';
import { CreateCalendarDto, UpdateCalendarDto } from './dto/calendar.dto';

/** 기본 색상 팔레트 (모노톤 디자인 위 기능적 강조용). */
const PALETTE = [
  'oklch(0.55 0.14 250)',
  'oklch(0.62 0.15 160)',
  'oklch(0.65 0.15 50)',
  'oklch(0.6 0.16 300)',
  'oklch(0.6 0.14 200)',
  'oklch(0.65 0.18 25)',
  'oklch(0.55 0.04 240)',
];

@Injectable()
export class CalendarService {
  private repo() {
    return DataSources.instance.getRepository(CalendarEntity);
  }

  list(churchId: number): Promise<CalendarEntity[]> {
    return this.repo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async create(churchId: number, dto: CreateCalendarDto): Promise<CalendarEntity> {
    const count = await this.repo().count({ where: { churchId } });
    const row = this.repo().create({
      churchId,
      name: dto.name,
      color: dto.color ?? PALETTE[count % PALETTE.length],
      description: dto.description,
      sortOrder: dto.sortOrder ?? count,
      isActive: dto.isActive ?? true,
    });
    return this.repo().save(row);
  }

  async update(churchId: number, id: number, dto: UpdateCalendarDto): Promise<CalendarEntity> {
    const found = await this.repo().findOne({ where: { id, churchId } });
    if (!found) throw new NotFoundException('달력을 찾을 수 없습니다.');
    await this.repo().update({ id, churchId }, dto);
    return (await this.repo().findOne({ where: { id, churchId } }))!;
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('달력을 찾을 수 없습니다.');
  }
}
