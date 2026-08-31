import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecouvrementController } from './recouvrement.controller';
import { RecouvrementService } from './recouvrement.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RecouvrementController],
  providers: [RecouvrementService],
  exports: [RecouvrementService],
})
export class RecouvrementModule {}
