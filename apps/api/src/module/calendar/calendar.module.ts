import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { GoogleCalendarModule } from '@src/module/google-calendar/google-calendar.module';
import { CalendarEventController } from './calendar-event.controller';
import { CalendarEventService } from './calendar-event.service';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [AuthModule, GoogleCalendarModule],
  controllers: [CalendarController, CalendarEventController, SubscriptionController, FeedController],
  providers: [CalendarService, CalendarEventService, SubscriptionService, FeedService],
  exports: [CalendarService, CalendarEventService],
})
export class CalendarModule {}
