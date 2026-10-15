import { Module } from '@nestjs/common';
import { CalendarModule } from '@src/module/calendar/calendar.module';
import { MissionaryModule } from '@src/module/missionary/missionary.module';
import { TrainingModule } from '@src/module/training/training.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [CalendarModule, MissionaryModule, TrainingModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
