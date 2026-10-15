import { IsInt, Min } from 'class-validator';

export class SelectChurchDto {
  @IsInt()
  @Min(1)
  churchId!: number;
}
