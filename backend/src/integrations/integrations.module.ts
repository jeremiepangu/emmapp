import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from './api-keys.service';
import { IntegrationsController } from './integrations.controller';
import { PublicApiController } from './public-api.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  controllers: [IntegrationsController, PublicApiController],
  providers: [ApiKeysService, WebhooksService, ApiKeyGuard],
  exports: [WebhooksService, ApiKeysService],
})
export class IntegrationsModule {}
