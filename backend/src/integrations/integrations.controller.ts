import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiKeysService } from './api-keys.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private keys: ApiKeysService) {}

  @Roles(UserRole.ADMIN, UserRole.IT_GED, UserRole.RESP_SECURITE)
  @Get('api-keys')
  listKeys() {
    return this.keys.listKeys();
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED)
  @Post('api-keys')
  createKey(@Body() body: { label: string; partner: string; scopes: string[] }) {
    return this.keys.createKey(body);
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED)
  @Delete('api-keys/:id')
  async revoke(@Param('id') id: string) {
    await this.keys.revoke(id);
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED, UserRole.RESP_SECURITE)
  @Get('webhooks')
  listWebhooks() {
    return this.keys.listWebhooks();
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED)
  @Post('webhooks')
  createWebhook(@Body() body: { label: string; url: string; events: string[] }) {
    if (!/^https?:\/\//i.test(body.url)) throw new BadRequestException('URL webhook invalide');
    return this.keys.createWebhook(body);
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED)
  @Delete('webhooks/:id')
  async deleteWebhook(@Param('id') id: string) {
    await this.keys.deleteWebhook(id);
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED)
  @Post('webhooks/:id/test')
  test(@Param('id') id: string) {
    return this.keys.testWebhook(id);
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED, UserRole.RESP_SECURITE)
  @Get('webhooks/:id/deliveries')
  deliveries(@Param('id') id: string) {
    return this.keys.deliveries(id);
  }
}
