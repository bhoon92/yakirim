import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  calendarIds!: number[];
}
