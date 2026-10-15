import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreateOfferingDto {
  @IsInt()
  @Min(1)
  memberId!: number;

  @IsInt()
  @Min(1)
  offeringCategoryId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  worshipServiceId?: number;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  rawDonorName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}
