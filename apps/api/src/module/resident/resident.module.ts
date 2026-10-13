import { Module } from '@nestjs/common';
import { AffiliationModule } from '@src/module/affiliation/affiliation.module';
import { AuthModule } from '@src/module/auth/auth.module';
import { MemberModule } from '@src/module/member/member.module';
import { MemberPositionModule } from '@src/module/position/member-position.module';
import { ResidentController } from './resident.controller';
import { ResidentDutyService } from './resident-duty.service';
import { ResidentStatusService } from './resident-status.service';
import { ResidentService } from './resident.service';

@Module({
  imports: [AuthModule, MemberModule, AffiliationModule, MemberPositionModule],
  controllers: [ResidentController],
  providers: [ResidentService, ResidentStatusService, ResidentDutyService],
  exports: [ResidentService],
})
export class ResidentModule {}
