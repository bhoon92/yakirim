import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { OrganizationChartController } from './organization-chart.controller';
import { OrganizationChartService } from './organization-chart.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationChartController],
  providers: [OrganizationChartService],
  exports: [OrganizationChartService],
})
export class OrganizationChartModule {}
