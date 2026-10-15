import { PartialType } from '@nestjs/swagger';
import { UpsertReferenceDto } from './upsert-reference.dto';

export class UpdateReferenceDto extends PartialType(UpsertReferenceDto) {}
