import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AffiliationKind } from '@src/module/affiliation/affiliation.service';

const AFFILIATION_KINDS = ['department', 'ministry', 'smallGroup', 'table'] as const;

export class ListMemberQueryDto {
  /** 이름·전화 부분 일치 */
  @IsOptional()
  @IsString()
  q?: string;

  /** 소속 검색: 부서/사역팀/공동체/테이블 종류 */
  @IsOptional()
  @IsIn(AFFILIATION_KINDS)
  affiliationKind?: AffiliationKind;

  /** 소속 검색: reference id (affiliationKind 와 함께) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  affiliationId?: number;

  /** 재적상태 필터 (status id) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  statusId?: number;

  /** `true` 면 현재 단계에 기준 일수 이상 머물러 있는 교인만. 대시보드 "정체된 사람" 과 같은 기준. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  stalled?: boolean;

  /** 담당 간사(resident id) 필터. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shepherdResidentId?: number;

  /** `true` 면 담당 간사가 없는 교인만. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  noShepherd?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
