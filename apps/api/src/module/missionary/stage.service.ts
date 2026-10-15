import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { MissionaryNoteEntity } from '@src/database/entities/missionary-note.entity';
import { MissionaryProfileEntity } from '@src/database/entities/missionary-profile.entity';
import { MissionaryStageEntity } from '@src/database/entities/missionary-stage.entity';
import { UpdateStageDto, UpsertStageDto } from './dto/missionary.dto';

/** 선교사 단계 기준정보 CRUD. 파송 절차가 교회마다 달라 코드가 이름을 알지 못한다. */
@Injectable()
export class MissionaryStageService {
  private repo() {
    return DataSources.instance.getRepository(MissionaryStageEntity);
  }

  async list(churchId: number): Promise<MissionaryStageEntity[]> {
    return this.repo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async findById(churchId: number, id: number): Promise<MissionaryStageEntity> {
    const stage = await this.repo().findOne({ where: { id, churchId } });
    if (!stage) throw new NotFoundException('선교사 단계를 찾을 수 없습니다.');
    return stage;
  }

  async create(churchId: number, dto: UpsertStageDto): Promise<MissionaryStageEntity> {
    return this.repo().save(
      this.repo().create({
        churchId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        countsAsActive: dto.countsAsActive ?? false,
      })
    );
  }

  async update(churchId: number, id: number, dto: UpdateStageDto): Promise<MissionaryStageEntity> {
    await this.findById(churchId, id);
    await this.repo().update({ id, churchId }, dto);
    return this.findById(churchId, id);
  }

  /** 사용 중인 단계는 삭제 대신 비활성화를 유도한다 — 지우면 기록의 단계 표시가 끊긴다. */
  async remove(churchId: number, id: number): Promise<void> {
    await this.findById(churchId, id);
    const [profiles, notes] = await Promise.all([
      DataSources.instance.getRepository(MissionaryProfileEntity).count({ where: { churchId, stageId: id } }),
      DataSources.instance.getRepository(MissionaryNoteEntity).count({ where: { churchId, stageId: id } }),
    ]);
    if (profiles > 0 || notes > 0) {
      throw new ConflictException(
        `사용 중인 단계입니다 (선교사 ${profiles}명, 기록 ${notes}건). 삭제 대신 비활성화(isActive: false)하세요.`
      );
    }
    await this.repo().softDelete({ id, churchId });
  }
}
