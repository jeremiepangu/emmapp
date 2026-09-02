import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmmapureController } from './emmapure.controller';
import { EmmapureService } from './emmapure.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EmmapureController],
  providers: [EmmapureService],
})
export class EmmapureModule {}
