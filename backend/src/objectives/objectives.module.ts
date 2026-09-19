import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ObjectivesController } from './objectives.controller';
import { ObjectivesService } from './objectives.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ObjectivesController],
  providers: [ObjectivesService],
  exports: [ObjectivesService],
})
export class ObjectivesModule {}
