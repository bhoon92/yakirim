import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateCareNoteTemplateDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  typeId?: number | null;

  @IsString()
  @Length(1, 5000)
  content!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  prayerRequest?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  statusNote?: string | null;
}
