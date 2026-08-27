import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsignesController } from './consignes.controller';
import { ConsignesService } from './consignes.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ConsignesController],
  providers: [ConsignesService],
  exports: [ConsignesService],
})
export class ConsignesModule {}
