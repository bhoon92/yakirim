import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleCalendarConnectionService } from './connection.service';
import { GoogleCalendarSyncService } from './sync.service';
import { GoogleOauthService } from './google-oauth.service';

/**
 * Google Calendar push 연동 (planning 5.1 2단계).
 * CalendarModule 이 GoogleCalendarSyncService 를 주입받아 일정 CRUD 시 push.
 */
@Module({
  imports: [AuthModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleOauthService, GoogleCalendarClient, GoogleCalendarConnectionService, GoogleCalendarSyncService],
  exports: [GoogleCalendarSyncService],
})
export class GoogleCalendarModule {}
