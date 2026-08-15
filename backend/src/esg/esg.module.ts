import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EsgController } from './esg.controller';
import { EsgService } from './esg.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EsgController],
  providers: [EsgService],
  exports: [EsgService],
})
export class EsgModule {}
