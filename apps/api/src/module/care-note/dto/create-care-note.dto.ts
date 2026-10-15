import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreateCareNoteDto {
  /** 기록 종류 id (care-note-types). 생략하면 활성 종류 중 첫 번째. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  typeId?: number;

  /** 기록일 (YYYY-MM-DD). 미지정 시 오늘. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  location?: string;

  @IsString()
  @Length(1, 5000)
  content!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  prayerRequest?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  statusNote?: string;
}
