import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VehiclesService, CreateVehicleDto } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_EXPLOITATION)
  @Post()
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_EXPLOITATION)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateVehicleDto> & { isActive?: boolean }) {
    return this.vehiclesService.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.vehiclesService.deactivate(id);
  }
}
