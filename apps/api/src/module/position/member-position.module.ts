import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { MemberPositionController } from './member-position.controller';
import { MemberPositionService } from './member-position.service';

@Module({
  imports: [AuthModule],
  controllers: [MemberPositionController],
  providers: [MemberPositionService],
  exports: [MemberPositionService],
})
export class MemberPositionModule {}
