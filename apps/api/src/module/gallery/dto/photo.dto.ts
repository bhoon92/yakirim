import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class PresignPhotoDto {
  @IsString()
  @Length(1, 200)
  filename!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  contentType?: string;
}

export class ConfirmPhotoDto {
  @IsString()
  @Length(1, 500)
  key!: string;

  @IsString()
  @Length(1, 200)
  originalName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}
