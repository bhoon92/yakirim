import { Module } from '@nestjs/common';
import { AuthModule } from '@src/module/auth/auth.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';
import { S3Service } from './s3.service';

@Module({
  imports: [AuthModule],
  controllers: [EventController, PhotoController],
  providers: [EventService, PhotoService, S3Service],
  exports: [EventService, PhotoService],
})
export class GalleryModule {}
