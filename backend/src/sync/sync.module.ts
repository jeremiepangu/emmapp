import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [DeliveriesModule, PaymentsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
