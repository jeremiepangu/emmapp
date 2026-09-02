import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceService } from './attendance.service';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { SirhService } from './sirh.service';

@Module({
  imports: [NotificationsModule],
  controllers: [HrController],
  providers: [HrService, SirhService, AttendanceService],
  exports: [HrService, SirhService, AttendanceService],
})
export class HrModule {}
