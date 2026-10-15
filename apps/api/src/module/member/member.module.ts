import { Module } from '@nestjs/common';
import { AffiliationModule } from '@src/module/affiliation/affiliation.module';
import { AuthModule } from '@src/module/auth/auth.module';
import { MemberPositionModule } from '@src/module/position/member-position.module';
import { ShepherdModule } from '@src/module/shepherd/shepherd.module';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { MemberStatusController } from './member-status.controller';
import { MemberStatusService } from './member-status.service';
import { MemberStatusHistoryService } from './member-status-history.service';
import { MemberViewController } from './member-view.controller';
import { MemberViewService } from './member-view.service';

@Module({
  imports: [AuthModule, AffiliationModule, MemberPositionModule, ShepherdModule],
  controllers: [MemberController, MemberStatusController, MemberViewController],
  providers: [MemberService, MemberStatusService, MemberStatusHistoryService, MemberViewService],
  // 상태 이력은 파송 연동·가져오기에서도 적립해야 해서 밖으로 내보낸다.
  exports: [MemberService, MemberStatusHistoryService],
})
export class MemberModule {}
