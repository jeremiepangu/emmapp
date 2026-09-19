import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from './api-keys.service';
import { IntegrationsController } from './integrations.controller';
import { PublicApiController } from './public-api.controller';
import { WebhooksService } from './webhooks.service';
import { PricingModule } from '../pricing/pricing.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PricingModule, NotificationsModule],
  controllers: [IntegrationsController, PublicApiController],
  providers: [ApiKeysService, WebhooksService, ApiKeyGuard],
  exports: [WebhooksService, ApiKeysService],
})
export class IntegrationsModule {}
