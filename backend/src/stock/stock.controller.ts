import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreateStockLocationDto, StockService } from './stock.service';
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

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Post('locations')
  createLocation(@Body() dto: CreateStockLocationDto) {
    return this.stockService.createLocation(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Patch('locations/:id')
  updateLocation(
    @Param('id') id: string,
    @Body() dto: Partial<CreateStockLocationDto>,
  ) {
    return this.stockService.updateLocation(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete('locations/:id')
  removeLocation(@Param('id') id: string) {
    return this.stockService.removeLocation(id);
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
