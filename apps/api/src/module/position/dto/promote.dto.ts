import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class PromotePositionDto {
  @IsInt()
  @Min(1)
  positionId!: number;

  /** 취임일 (YYYY-MM-DD). 미지정 시 오늘. 이전 직분 종료일도 같은 날로. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
