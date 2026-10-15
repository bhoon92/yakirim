import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

export class CreateCalendarDto {
  @IsString()
  @Length(1, 40)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 직접 고른 아이콘(이모지 한 개). null 을 보내면 이름으로 자동 배정으로 되돌린다. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string | null;
}

export class UpdateCalendarDto extends PartialType(CreateCalendarDto) {}
