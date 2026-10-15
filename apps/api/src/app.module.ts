import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AffiliationModule } from './module/affiliation/affiliation.module';
import { AttendanceModule } from './module/attendance/attendance.module';
import { AuthModule } from './module/auth/auth.module';
import { CalendarModule } from './module/calendar/calendar.module';
import { CareNoteModule } from './module/care-note/care-note.module';
import { ChurchModule } from './module/church/church.module';
import { ExportModule } from './module/export/export.module';
import { ImportModule } from './module/import/import.module';
import { FinanceModule } from './module/finance/finance.module';
import { GalleryModule } from './module/gallery/gallery.module';
import { GoogleCalendarModule } from './module/google-calendar/google-calendar.module';
import { HomeModule } from './module/home/home.module';
import { MemberModule } from './module/member/member.module';
import { MissionaryModule } from './module/missionary/missionary.module';
import { OrganizationChartModule } from './module/organization-chart/organization-chart.module';
import { MemberPositionModule } from './module/position/member-position.module';
import { ReferenceModule } from './module/reference/reference.module';
import { ResidentModule } from './module/resident/resident.module';
import { ShepherdModule } from './module/shepherd/shepherd.module';
import { TeamModule } from './module/team/team.module';
import { TrainingModule } from './module/training/training.module';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    // production: apps/web/dist 정적 파일 서빙 (SPA 폴백 포함). /api* 는 제외.
    ...(isProduction
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', '..', '..', '..', 'apps', 'web', 'dist'),
            // Express 5(path-to-regexp v8) 문법. 예전 '/api*' 는 요청마다 PathError 를 던져
            // SPA 딥링크(/app/members 새로고침 등)가 전부 500 이었다.
            exclude: ['/api/{*path}'],
          }),
        ]
      : []),
    AuthModule,
    ChurchModule,
    ResidentModule,
    ShepherdModule,
    MemberModule,
    TrainingModule,
    MissionaryModule,
    ReferenceModule,
    AffiliationModule,
    OrganizationChartModule,
    MemberPositionModule,
    CareNoteModule,
    AttendanceModule,
    FinanceModule,
    ExportModule,
    ImportModule,
    GalleryModule,
    CalendarModule,
    GoogleCalendarModule,
    TeamModule,
    HomeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
