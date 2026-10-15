import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

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
}
