import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { StockService } from './stock.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private stockService: StockService) {}

  @Get('locations')
  getLocations() {
    return this.stockService.getLocations();
  }

  @Get()
  getByLocation(@Query('locationId') locationId?: string) {
    return this.stockService.getByLocation(locationId);
  }

  @Get('vehicle/:vehicleId')
  getVehicleStock(@Param('vehicleId') vehicleId: string) {
    return this.stockService.getVehicleStock(vehicleId);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_PRODUCTION)
  @Post('adjust')
  adjust(
    @Body()
    body: {
      productId: string;
      locationId: string;
      quantity: number;
      lotNumber?: string;
    },
  ) {
    return this.stockService.adjustStock(
      body.productId,
      body.locationId,
      body.quantity,
      body.lotNumber,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Patch(':id')
  setQuantity(@Param('id') id: string, @Body() body: { quantity: number }) {
    return this.stockService.setQuantity(id, body.quantity);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}
