import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
