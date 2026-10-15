import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { EventEntity } from '@src/database/entities/event.entity';
import { PhotoEntity } from '@src/database/entities/photo.entity';
import { ConfirmPhotoDto, PresignPhotoDto } from './dto/photo.dto';
import { S3Service } from './s3.service';

export type PhotoItem = {
  id: number;
  originalName: string;
  contentType: string | null;
  size: number | null;
  url: string;
  createdAt: Date;
};

@Injectable()
export class PhotoService {
  constructor(private readonly s3: S3Service) {}

  private repo() {
    return DataSources.instance.getRepository(PhotoEntity);
  }

  async listForEvent(churchId: number, eventId: number): Promise<PhotoItem[]> {
    await this.assertEvent(churchId, eventId);
    const rows = await this.repo().find({
      where: { churchId, eventId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return Promise.all(
      rows.map(async photo => ({
        id: photo.id,
        originalName: photo.originalName,
        contentType: photo.contentType ?? null,
        size: photo.size ?? null,
        url: await this.s3.presignGet(photo.s3Key),
        createdAt: photo.createdAt,
      }))
    );
  }

  /** 1단계 — 업로드용 presigned URL 발급. */
  async presign(churchId: number, eventId: number, dto: PresignPhotoDto): Promise<{ key: string; uploadUrl: string }> {
    await this.assertEvent(churchId, eventId);
    const key = this.s3.buildKey(churchId, eventId, dto.filename);
    const uploadUrl = await this.s3.presignPut(key, dto.contentType);
    return { key, uploadUrl };
  }

  /** 2단계 — S3 업로드 완료 후 메타데이터 row 생성. */
  async confirm(churchId: number, eventId: number, uploaderAccountId: number, dto: ConfirmPhotoDto): Promise<PhotoEntity> {
    await this.assertEvent(churchId, eventId);
    const expectedPrefix = `church/${churchId}/event/${eventId}/`;
    if (!dto.key.startsWith(expectedPrefix)) {
      throw new BadRequestException('잘못된 업로드 key 입니다.');
    }
    const row = this.repo().create({
      churchId,
      eventId,
      s3Key: dto.key,
      originalName: dto.originalName,
      contentType: dto.contentType,
      size: dto.size,
      uploaderAccountId,
    });
    return this.repo().save(row);
  }

  async remove(churchId: number, eventId: number, photoId: number): Promise<void> {
    const photo = await this.repo().findOne({ where: { id: photoId, churchId, eventId } });
    if (!photo) throw new NotFoundException('사진을 찾을 수 없습니다.');
    await this.s3.remove(photo.s3Key).catch(() => undefined); // best effort
    await this.repo().softDelete(photo.id);
  }

  /** 행사 삭제 시 연쇄 — S3 객체 + row 정리. */
  async removeAllForEvent(churchId: number, eventId: number): Promise<void> {
    const rows = await this.repo().find({ where: { churchId, eventId } });
    await Promise.all(rows.map(photo => this.s3.remove(photo.s3Key).catch(() => undefined)));
    if (rows.length > 0) {
      await this.repo().softDelete(rows.map(photo => photo.id));
    }
  }

  private async assertEvent(churchId: number, eventId: number): Promise<void> {
    const e = await DataSources.instance.getRepository(EventEntity).findOne({ where: { id: eventId, churchId } });
    if (!e) throw new NotFoundException('행사를 찾을 수 없습니다.');
  }
}
