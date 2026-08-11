import {
  Body,
  Controller,
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
import { CreateTourDto } from './dto/tour.dto';
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

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.SUPERVISEUR)
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

  @Roles(UserRole.LIVREUR, UserRole.ADMIN)
  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.toursService.startTour(id);
  }

  @Roles(UserRole.LIVREUR, UserRole.ADMIN)
  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return this.toursService.completeTour(id);
  }
}
