import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { ChurchController } from './church.controller';
import { ChurchService } from './church.service';

@Module({
  imports: [AuthModule],
  controllers: [ChurchController],
  providers: [ChurchService],
})
export class ChurchModule {}
