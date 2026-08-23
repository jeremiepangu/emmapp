import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FinanceModule } from '../finance/finance.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [PricingModule, NotificationsModule, FinanceModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
