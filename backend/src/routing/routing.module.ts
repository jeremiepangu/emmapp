import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { TourRouteController } from './tour-route.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [RoutingController, TourRouteController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
