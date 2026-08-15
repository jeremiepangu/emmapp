import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { IotController } from './iot.controller';
import { IotService } from './iot.service';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [NotificationsModule],
  controllers: [IotController],
  providers: [IotService, TelemetryService],
  exports: [IotService, TelemetryService],
})
export class IotModule {}
