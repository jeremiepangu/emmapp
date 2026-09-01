import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AssistantModule } from '../assistant/assistant.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { PortalAccountsController, PortalController } from './portal.controller';
import { PortalAuthGuard } from './portal-auth.guard';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';

@Module({
  imports: [
    NotificationsModule,
    AssistantModule,
    PricingModule,
    PaymentsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [PortalController, PortalAccountsController],
  providers: [PortalService, PortalAuthService, PortalAuthGuard],
  exports: [PortalService],
})
export class PortalModule {}
