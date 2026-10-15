import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { FinanceModule } from '@src/module/finance/finance.module';
import { MemberModule } from '@src/module/member/member.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [AuthModule, FinanceModule, MemberModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
