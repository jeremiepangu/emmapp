import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
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

  @Roles(UserRole.LIVREUR, UserRole.COMMERCIAL, UserRole.ADMIN)
  @Post()
  create(
    @Body() dto: CreateDeliveryDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.deliveriesService.create(dto, req.user.id);
  }
}
