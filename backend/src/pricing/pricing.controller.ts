import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/pricing-rule.dto';
import { PricingService } from './pricing.service';

@ApiTags('pricing-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing-rules')
export class PricingController {
  constructor(private pricing: PricingService) {}

  @Get()
  findAll() {
    return this.pricing.findAll();
  }

  @Get('preview')
  preview(
    @Query('clientId') clientId: string,
    @Query('productId') productId: string,
    @Query('quantity') quantity = '1',
    @Query('driverId') driverId?: string,
  ) {
    return this.pricing.preview(clientId, productId, Math.max(1, Number(quantity) || 1), driverId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pricing.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.COMMERCIAL)
  @Post()
  create(@Body() dto: CreatePricingRuleDto) {
    return this.pricing.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.COMMERCIAL)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePricingRuleDto) {
    return this.pricing.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.COMMERCIAL)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.pricing.deactivate(id);
  }
}
