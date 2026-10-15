import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Min } from 'class-validator';
import { RECURRENCE_VALUES } from '../recurrence';

export class CreateCalendarEventDto {
  @IsInt()
  @Min(1)
  calendarId!: number;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  location?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsISO8601()
  startAt!: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsIn(RECURRENCE_VALUES)
  recurrence?: (typeof RECURRENCE_VALUES)[number];
}

export class UpdateCalendarEventDto extends PartialType(CreateCalendarEventDto) {}

export class ListEventQueryDto {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}
