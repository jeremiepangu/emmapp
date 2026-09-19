import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [NotificationsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
