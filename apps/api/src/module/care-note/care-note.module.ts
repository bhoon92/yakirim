import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { CareNoteController } from './care-note.controller';
import { CareNoteService } from './care-note.service';

@Module({
  imports: [AuthModule],
  controllers: [CareNoteController],
  providers: [CareNoteService],
  exports: [CareNoteService],
})
export class CareNoteModule {}
