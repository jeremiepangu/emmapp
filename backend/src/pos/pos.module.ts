import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { ConsignesModule } from '../consignes/consignes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FinanceModule } from '../finance/finance.module';
import { PaymentsModule } from '../payments/payments.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [PricingModule, ConsignesModule, NotificationsModule, FinanceModule, PaymentsModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
