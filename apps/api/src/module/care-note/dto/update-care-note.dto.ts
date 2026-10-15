import { PartialType } from '@nestjs/swagger';
import { CreateCareNoteDto } from './create-care-note.dto';

export class UpdateCareNoteDto extends PartialType(CreateCareNoteDto) {}
