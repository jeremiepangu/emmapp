import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PackagingController } from './packaging.controller';
import { PackagingService } from './packaging.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PackagingController],
  providers: [PackagingService],
  exports: [PackagingService],
})
export class PackagingModule {}
