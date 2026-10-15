import { IsInt, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** 직접 고른 아이콘(이모지 한 개). null 을 보내면 이름으로 자동 배정으로 되돌린다. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string | null;
}
