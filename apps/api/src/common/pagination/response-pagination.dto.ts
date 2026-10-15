import { Type } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDataInterface, PaginationInfoInterface } from '@src/common/pagination/pagination.interface';
import { Exclude, Expose, plainToInstance } from 'class-transformer';

@Exclude()
export class ResponsePaginationInfoDto implements PaginationInfoInterface {
  @ApiProperty({
    description: `최대 page`,
  })
  @Expose()
  maxPage: number;

  @ApiProperty({
    description: `현재 page`,
  })
  @Expose()
  page: number;

  @ApiProperty({
    description: `페이지 크기`,
  })
  @Expose()
  size: number;

  @ApiPropertyOptional({
    description: `총 데이터 수량`,
  })
  @Expose()
  maxCount: number;
}

abstract class ResponsePaginationDataDto<T> implements PaginationDataInterface<T> {
  data: T[];
  pagination: ResponsePaginationInfoDto;

  constructor(data: T[], pagination: PaginationInfoInterface) {
    this.data = data;
    this.pagination = plainToInstance(ResponsePaginationInfoDto, pagination);
  }
}

export function makeResponsePaginationDto<T>(classRef: Type<T>, dataName?: string): Type<ResponsePaginationDataDto<T>> {
  @Exclude()
  class ResponsePaginationDto<T> extends ResponsePaginationDataDto<T> {
    @ApiProperty({
      description: `${dataName ?? classRef.name} 리스트`,
      type: classRef,
      isArray: true,
    })
    @Expose()
    data: T[];

    @ApiProperty({
      description: 'pagination 정보',
    })
    @Expose()
    pagination: ResponsePaginationInfoDto;
  }

  return ResponsePaginationDto;
}
