import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { AccountCategoryController } from './account-category.controller';
import { DepartmentController } from './department.controller';
import { MinistryController } from './ministry.controller';
import { OfferingCategoryController } from './offering-category.controller';
import { CareNoteTypeController } from './care-note-type.controller';
import { PositionController } from './position.controller';
import { ReferenceService } from './reference.service';
import { SmallGroupController } from './small-group.controller';
import { WorshipServiceController } from './worship-service.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    DepartmentController,
    MinistryController,
    SmallGroupController,
    PositionController,
    CareNoteTypeController,
    WorshipServiceController,
    OfferingCategoryController,
    AccountCategoryController,
  ],
  providers: [ReferenceService],
  exports: [ReferenceService],
})
export class ReferenceModule {}
