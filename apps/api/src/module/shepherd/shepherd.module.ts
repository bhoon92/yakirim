import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { ShepherdController } from './shepherd.controller';
import { ShepherdService } from './shepherd.service';

/** 교인·간사 모듈이 모두 가져다 쓴다. 이 모듈은 둘 다에 기대지 않는다. */
@Module({
  imports: [AuthModule],
  controllers: [ShepherdController],
  providers: [ShepherdService],
  exports: [ShepherdService],
})
export class ShepherdModule {}
