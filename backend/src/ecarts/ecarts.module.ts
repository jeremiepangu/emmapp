import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CashClosingService } from './cash-closing.service';
import { DiscrepanciesService } from './discrepancies.service';
import { EcartsController } from './ecarts.controller';
import { TourReconciliationService } from './tour-reconciliation.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EcartsController],
  providers: [DiscrepanciesService, CashClosingService, TourReconciliationService],
  exports: [DiscrepanciesService, CashClosingService, TourReconciliationService],
})
export class EcartsModule {}
