import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { AffiliationController } from './affiliation.controller';
import { AffiliationService } from './affiliation.service';

@Module({
  imports: [AuthModule],
  controllers: [AffiliationController],
  providers: [AffiliationService],
  exports: [AffiliationService],
})
export class AffiliationModule {}
