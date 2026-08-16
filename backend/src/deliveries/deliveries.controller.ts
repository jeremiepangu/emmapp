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
import { DeliveryStatus, UserRole } from '@prisma/client';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/delivery.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('deliveries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deliveries')
export class DeliveriesController {
  constructor(private deliveriesService: DeliveriesService) {}

  @Get()
  findAll(
    @Query('tourId') tourId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.deliveriesService.findAll({ tourId, driverId });
  }

  @Get('tour/:tourId/reconciliation')
  reconciliation(@Param('tourId') tourId: string) {
    return this.deliveriesService.getTourReconciliation(tourId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveriesService.findOne(id);
  }

  @Roles(UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON, UserRole.COMMERCIAL, UserRole.ADMIN)
  @Post()
  create(
    @Body() dto: CreateDeliveryDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.deliveriesService.create(dto, req.user.id);
  }

  @Roles(UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON, UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { status: DeliveryStatus; notes?: string },
  ) {
    return this.deliveriesService.updateStatus(id, body.status, body.notes);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveriesService.remove(id);
  }
}
