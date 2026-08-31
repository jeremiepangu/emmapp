import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { ConsignesModule } from '../consignes/consignes.module';
import { EcartsModule } from '../ecarts/ecarts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConsignesModule, EcartsModule, NotificationsModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
