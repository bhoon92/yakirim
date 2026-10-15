import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSources } from '@src/database/data-sources';
import { FiscalYearEntity } from '@src/database/entities/fiscal-year.entity';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';

@Injectable()
export class FiscalYearService {
  private repo() {
    return DataSources.instance.getRepository(FiscalYearEntity);
  }

  list(churchId: number): Promise<FiscalYearEntity[]> {
    return this.repo().find({ where: { churchId }, order: { startDate: 'DESC', id: 'DESC' } });
  }

  current(churchId: number): Promise<FiscalYearEntity | null> {
    return this.repo().findOne({ where: { churchId, isCurrent: true } });
  }

  async create(churchId: number, dto: CreateFiscalYearDto): Promise<FiscalYearEntity> {
    return DataSources.instance.transaction(async manager => {
      const repo = manager.getRepository(FiscalYearEntity);
      if (dto.isCurrent) {
        await repo.update({ churchId, isCurrent: true }, { isCurrent: false });
      }
      const row = repo.create({
        churchId,
        name: dto.name,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isCurrent: dto.isCurrent ?? false,
      });
      return repo.save(row);
    });
  }

  async setCurrent(churchId: number, id: number): Promise<FiscalYearEntity> {
    return DataSources.instance.transaction(async manager => {
      const repo = manager.getRepository(FiscalYearEntity);
      const target = await repo.findOne({ where: { id, churchId } });
      if (!target) throw new NotFoundException('회계연도를 찾을 수 없습니다.');
      await repo.update({ churchId, isCurrent: true }, { isCurrent: false });
      await repo.update(id, { isCurrent: true });
      return (await repo.findOne({ where: { id, churchId } }))!;
    });
  }

  async remove(churchId: number, id: number): Promise<void> {
    const result = await this.repo().softDelete({ id, churchId });
    if (!result.affected) throw new NotFoundException('회계연도를 찾을 수 없습니다.');
  }
}
