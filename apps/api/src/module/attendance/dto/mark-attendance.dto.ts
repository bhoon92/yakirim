import { IsBoolean, IsInt, Matches, Min } from 'class-validator';

export class MarkAttendanceDto {
  @IsInt()
  @Min(1)
  worshipServiceId!: number;

  @IsInt()
  @Min(1)
  memberId!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsBoolean()
  present!: boolean;
}
