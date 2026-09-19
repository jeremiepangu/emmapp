import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
