import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FinanceModule } from '../finance/finance.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ClientCreditService } from './client-credit.service';

@Module({
  imports: [NotificationsModule, FinanceModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ClientCreditService],
  exports: [PaymentsService, ClientCreditService],
})
export class PaymentsModule {}
