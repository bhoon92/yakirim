import { plainToInstance, Type } from 'class-transformer';
import { PaginationInterface } from './pagination.interface';
import { ApiProperty } from '@nestjs/swagger';
import { IsMinWithError } from '@src/util/dto-validator';
import { ResponsePaginationInfoDto } from './response-pagination.dto';

export class RequestPaginationDto implements PaginationInterface {
  @ApiProperty({
    description: '현재 페이지',
    default: 1,
    required: false,
  })
  @IsMinWithError('현재 페이지', 1, { required: false })
  @Type(() => Number)
  readonly page: number = 1;

  @ApiProperty({
    description: '페이지 크기',
    default: 30,
    required: false,
  })
  @IsMinWithError('페이지 크기', 5, { required: false })
  @Type(() => Number)
  readonly size: number = 30;

  get skip(): number {
    return (this.page - 1) * this.size;
  }

  get take(): number {
    return this.size;
  }

  toPaginationInfo(maxCount: number): ResponsePaginationInfoDto {
    let maxPage;
    if (maxCount >= 0) {
      maxPage = Math.ceil(maxCount / this.size);
    }
    return plainToInstance(ResponsePaginationInfoDto, {
      ...this,
      maxPage,
      maxCount,
    });
  }
}
