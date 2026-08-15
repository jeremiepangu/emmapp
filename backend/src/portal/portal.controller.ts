import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssistantChannel, PaymentMethod, UserRole } from '@prisma/client';
import { Public } from '../common/decorators/roles.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssistantService } from '../assistant/assistant.service';
import { PortalAuthGuard } from './portal-auth.guard';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';

@ApiTags('portal')
@Public()
@Controller('portal')
export class PortalController {
  constructor(
    private auth: PortalAuthService,
    private portal: PortalService,
    private assistant: AssistantService,
  ) {}

  @Public()
  @Post('auth/login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @UseGuards(PortalAuthGuard)
  @Get('me')
  me(@Req() req: { portal: { clientId: string; accountId: string } }) {
    return this.portal.me(req.portal.clientId, req.portal.accountId);
  }

  @UseGuards(PortalAuthGuard)
  @Get('catalog')
  catalog(@Req() req: { portal: { clientId: string } }) {
    return this.portal.catalog(req.portal.clientId);
  }

  @UseGuards(PortalAuthGuard)
  @Get('orders')
  orders(@Req() req: { portal: { clientId: string } }) {
    return this.portal.orders(req.portal.clientId);
  }

  @UseGuards(PortalAuthGuard)
  @Post('orders')
  createOrder(
    @Req() req: { portal: { clientId: string } },
    @Body() body: { lines: Array<{ productId: string; quantity: number }>; notes?: string },
  ) {
    return this.portal.createOrder(req.portal.clientId, body);
  }

  @UseGuards(PortalAuthGuard)
  @Get('deliveries')
  deliveries(@Req() req: { portal: { clientId: string } }) {
    return this.portal.deliveries(req.portal.clientId);
  }

  @UseGuards(PortalAuthGuard)
  @Get('deliveries/:id/tracking')
  tracking(@Req() req: { portal: { clientId: string } }, @Param('id') id: string) {
    return this.portal.tracking(req.portal.clientId, id);
  }

  @UseGuards(PortalAuthGuard)
  @Get('invoices')
  invoices(@Req() req: { portal: { clientId: string } }) {
    return this.portal.invoices(req.portal.clientId);
  }

  @UseGuards(PortalAuthGuard)
  @Post('payments')
  pay(
    @Req() req: { portal: { clientId: string } },
    @Body() body: { orderId?: string; amount: number; method: PaymentMethod; reference?: string },
  ) {
    return this.portal.pay(req.portal.clientId, body);
  }

  @UseGuards(PortalAuthGuard)
  @Get('loyalty')
  loyalty(@Req() req: { portal: { clientId: string } }) {
    return this.portal.loyalty(req.portal.clientId);
  }

  @UseGuards(PortalAuthGuard)
  @Post('loyalty/redeem')
  redeem(@Req() req: { portal: { clientId: string } }, @Body() body: { points: number }) {
    return this.portal.redeem(req.portal.clientId, body.points);
  }

  @UseGuards(PortalAuthGuard)
  @Get('consignes')
  consignes(@Req() req: { portal: { clientId: string } }) {
    return this.portal.consignes(req.portal.clientId);
  }

  @UseGuards(PortalAuthGuard)
  @Post('assistant/query')
  ask(
    @Req() req: { portal: { clientId: string; accountId: string } },
    @Body() body: { question: string; sessionId?: string },
  ) {
    return this.assistant.ask({
      question: body.question,
      sessionId: body.sessionId,
      channel: AssistantChannel.PORTAIL,
      portalAccountId: req.portal.accountId,
      clientId: req.portal.clientId,
    });
  }
}

@ApiTags('portal-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portal/accounts')
export class PortalAccountsController {
  constructor(private portal: PortalService) {}

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.COMMERCIAL)
  @Get()
  list() {
    return this.portal.listAccounts();
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Post()
  create(@Body() body: { email: string; password: string; fullName: string; clientId: string }) {
    return this.portal.createAccount(body);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { isActive?: boolean; fullName?: string; password?: string }) {
    return this.portal.updateAccount(id, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.portal.deleteAccount(id);
  }
}
