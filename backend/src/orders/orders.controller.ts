import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('clientId') clientId?: string,
    @Query('tourId') tourId?: string,
  ) {
    return this.ordersService.findAll({ status, clientId, tourId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.LIVREUR)
  @Post()
  create(@Req() req: { user: { id: string; role: string } }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION)
  @Patch(':id/validate')
  validate(@Param('id') id: string) {
    return this.ordersService.validate(id);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.ordersService.updateNotes(id, body.notes ?? '');
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
