import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { CareNoteTemplateController } from './care-note-template.controller';
import { CareNoteTemplateService } from './care-note-template.service';
import { CareNoteController } from './care-note.controller';
import { CareNoteService } from './care-note.service';

@Module({
  imports: [AuthModule],
  controllers: [CareNoteController, CareNoteTemplateController],
  providers: [CareNoteService, CareNoteTemplateService],
  exports: [CareNoteService],
})
export class CareNoteModule {}
