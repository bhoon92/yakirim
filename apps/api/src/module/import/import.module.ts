import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { MemberModule } from '@src/module/member/member.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [AuthModule, MemberModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
