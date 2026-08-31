import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentMethod, UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Query('deliveryId') deliveryId?: string,
    @Query('orderId') orderId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.paymentsService.findAll({ deliveryId, orderId, clientId });
  }

  @Get('outstanding')
  outstanding(@Query('clientId') clientId?: string) {
    return this.paymentsService.outstanding(clientId);
  }

  @Roles(UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON, UserRole.CAISSIER, UserRole.COMMERCIAL, UserRole.ADMIN)
  @Post()
  create(
    @Body() dto: CreatePaymentDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.paymentsService.create(dto, req.user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.CAISSIER, UserRole.COMPTABLE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{ amount: number; method: PaymentMethod; reference: string }>,
  ) {
    return this.paymentsService.update(id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.CAISSIER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
