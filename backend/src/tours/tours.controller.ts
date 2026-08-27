import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TourStatus, UserRole } from '@prisma/client';
import { ToursService } from './tours.service';
import { CreateTourDto, UpdateTourDto } from './dto/tour.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('tours')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tours')
export class ToursController {
  constructor(private toursService: ToursService) {}

  @Get()
  findAll(
    @Query('date') date?: string,
    @Query('driverId') driverId?: string,
    @Query('status') status?: TourStatus,
  ) {
    return this.toursService.findAll({ date, driverId, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.toursService.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.SUPERVISEUR, UserRole.CHEF_EXPLOITATION)
  @Post()
  create(@Body() dto: CreateTourDto) {
    return this.toursService.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Post(':id/load-sheet')
  createLoadSheet(
    @Param('id') id: string,
    @Body() body: { items: unknown[] },
  ) {
    return this.toursService.createLoadSheet(id, body.items);
  }

  @Patch(':id/load-sheet/:sheetId/validate')
  validateLoadSheet(
    @Param('id') id: string,
    @Param('sheetId') sheetId: string,
    @Body() body: { role: 'store' | 'driver' },
  ) {
    return this.toursService.validateLoadSheet(id, sheetId, body.role);
  }

  @Roles(UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON, UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.toursService.startTour(id);
  }

  @Roles(UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON, UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return this.toursService.completeTour(id);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_EXPLOITATION, UserRole.SUPERVISEUR)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.toursService.cancelTour(id);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.SUPERVISEUR, UserRole.CHEF_EXPLOITATION)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTourDto) {
    return this.toursService.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.toursService.remove(id);
  }
}
