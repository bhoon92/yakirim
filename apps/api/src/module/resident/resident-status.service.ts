import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { ResidentProfileEntity } from '@src/database/entities/resident-profile.entity';
import { ResidentStatusHistoryEntity } from '@src/database/entities/resident-status-history.entity';
import { ResidentPhase, ResidentStatusEntity } from '@src/database/entities/resident-status.entity';
import { UpdateResidentStatusDto, UpsertResidentStatusDto } from './dto/resident.dto';

/** 간사 상태 기준정보 CRUD. 선교사 단계와 같은 규칙 — 코드는 이름을 모르고 countsAsActive 만 안다. */
@Injectable()
export class ResidentStatusService {
  private repo() {
    return DataSources.instance.getRepository(ResidentStatusEntity);
  }

  async list(churchId: number): Promise<ResidentStatusEntity[]> {
    return this.repo().find({ where: { churchId }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async findById(churchId: number, id: number): Promise<ResidentStatusEntity> {
    const status = await this.repo().findOne({ where: { id, churchId } });
    if (!status) throw new NotFoundException('간사 상태를 찾을 수 없습니다.');
    return status;
  }

  async create(churchId: number, dto: UpsertResidentStatusDto): Promise<ResidentStatusEntity> {
    return this.repo().save(
      this.repo().create({
        churchId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        ...this.phaseFields(dto),
      })
    );
  }

  /**
   * phase 와 countsAsActive 를 같게 맞춘다 — 코드 곳곳의 집계가 countsAsActive 를 보기 때문.
   * phase 를 주면 그대로, countsAsActive 만 주면(예전 클라이언트) 간사/떠남으로 옮긴다.
   */
  private phaseFields(dto: { phase?: ResidentPhase; countsAsActive?: boolean }, current?: ResidentStatusEntity) {
    const phase =
      dto.phase ??
      (dto.countsAsActive === undefined
        ? (current?.phase ?? ResidentPhase.LEFT)
        : dto.countsAsActive
          ? ResidentPhase.RESIDENT
          : current?.phase === ResidentPhase.PREPARING
            ? ResidentPhase.PREPARING
            : ResidentPhase.LEFT);
    return { phase, countsAsActive: phase === ResidentPhase.RESIDENT };
  }

  async update(churchId: number, id: number, dto: UpdateResidentStatusDto): Promise<ResidentStatusEntity> {
    const current = await this.findById(churchId, id);
    const touchesPhase = dto.phase !== undefined || dto.countsAsActive !== undefined;
    await this.repo().update({ id, churchId }, { ...dto, ...(touchesPhase ? this.phaseFields(dto, current) : {}) });
    return this.findById(churchId, id);
  }

  /** 사용 중인 상태는 삭제 대신 비활성화를 유도한다 — 지우면 이력의 상태 표시가 끊긴다. */
  async remove(churchId: number, id: number): Promise<void> {
    await this.findById(churchId, id);
    const [profiles, history] = await Promise.all([
      DataSources.instance.getRepository(ResidentProfileEntity).count({ where: { churchId, statusId: id } }),
      DataSources.instance.getRepository(ResidentStatusHistoryEntity).count({ where: { churchId, statusId: id } }),
    ]);
    if (profiles > 0 || history > 0) {
      throw new ConflictException(
        `사용 중인 상태입니다 (간사 ${profiles}명, 이력 ${history}건). 삭제 대신 비활성화(isActive: false)하세요.`
      );
    }
    await this.repo().softDelete({ id, churchId });
  }
}
