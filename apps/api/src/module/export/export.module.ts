import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { FinanceModule } from '@src/module/finance/finance.module';
import { MemberModule } from '@src/module/member/member.module';
import { MissionaryModule } from '@src/module/missionary/missionary.module';
import { ResidentModule } from '@src/module/resident/resident.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [AuthModule, FinanceModule, MemberModule, ResidentModule, MissionaryModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
