import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { EventEntity } from '@src/database/entities/event.entity';
import { PhotoEntity } from '@src/database/entities/photo.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PhotoService } from './photo.service';

@Injectable()
export class EventService {
  constructor(private readonly photos: PhotoService) {}

  private repo() {
    return DataSources.instance.getRepository(EventEntity);
  }

  /** 행사 목록 + 각 행사 사진 수. */
  async list(churchId: number): Promise<(EventEntity & { photoCount: number })[]> {
    const events = await this.repo().find({
      where: { churchId },
      order: { date: 'DESC', sortOrder: 'ASC', id: 'DESC' },
    });
    if (events.length === 0) return [];

    const counts = (await DataSources.instance
      .getRepository(PhotoEntity)
      .createQueryBuilder('p')
      .select('p.event_id', 'eventId')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.church_id = :churchId', { churchId })
      .andWhere('p.deleted_at IS NULL')
      .groupBy('p.event_id')
      .getRawMany()) as { eventId: number; cnt: string }[];
    const countMap = new Map(counts.map(eventCount => [Number(eventCount.eventId), Number(eventCount.cnt)]));

    return events.map(event => Object.assign(event, { photoCount: countMap.get(event.id) ?? 0 }));
  }

  create(churchId: number, dto: CreateEventDto): Promise<EventEntity> {
    const row = this.repo().create({ ...dto, churchId });
    return this.repo().save(row);
  }

  async update(churchId: number, id: number, dto: UpdateEventDto): Promise<EventEntity> {
    const found = await this.repo().findOne({ where: { id, churchId } });
    if (!found) throw new NotFoundException('행사를 찾을 수 없습니다.');
    await this.repo().update({ id, churchId }, dto);
    return (await this.repo().findOne({ where: { id, churchId } }))!;
  }

  async remove(churchId: number, id: number): Promise<void> {
    const found = await this.repo().findOne({ where: { id, churchId } });
    if (!found) throw new NotFoundException('행사를 찾을 수 없습니다.');
    await this.photos.removeAllForEvent(churchId, id);
    await this.repo().softDelete({ id, churchId });
  }
}
