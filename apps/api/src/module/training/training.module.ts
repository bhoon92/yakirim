import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { MemberModule } from '@src/module/member/member.module';
import { TrainingCohortController } from './cohort.controller';
import { TrainingCohortService } from './cohort.service';
import { TrainingCourseController } from './course.controller';
import { TrainingCourseService } from './course.service';
import { TrainingEnrollmentController } from './enrollment.controller';
import { TrainingEnrollmentService } from './enrollment.service';
import { TrainingPromotionService } from './promotion.service';

@Module({
  imports: [AuthModule, MemberModule],
  // enrollment 컨트롤러가 'training/enrollments/*' 와 'training/members/*' 를 잡으므로
  // 'training/cohorts/*' 와 경로가 겹치지 않는다.
  controllers: [TrainingCourseController, TrainingCohortController, TrainingEnrollmentController],
  providers: [TrainingCourseService, TrainingCohortService, TrainingEnrollmentService, TrainingPromotionService],
  exports: [TrainingCourseService, TrainingCohortService, TrainingEnrollmentService],
})
export class TrainingModule {}
