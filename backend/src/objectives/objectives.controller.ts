import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateActivityObjectiveDto, UpdateActivityObjectiveDto } from './dto/objective.dto';
import { ObjectivesService } from './objectives.service';

const WRITE = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.CHEF_EXPLOITATION,
  UserRole.SUPERVISEUR,
  UserRole.COMMERCIAL,
] as const;

@ApiTags('activity-objectives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity-objectives')
export class ObjectivesController {
  constructor(private objectives: ObjectivesService) {}

  @Get()
  findAll(
    @Req() req: { user: { id: string; role: UserRole } },
    @Query('userId') userId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.objectives.list(req.user, {
      userId,
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
  }

  @Get('catalog')
  catalog() {
    return this.objectives.catalog();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.objectives.findOne(id);
  }

  @Roles(...WRITE)
  @Post()
  create(@Body() dto: CreateActivityObjectiveDto) {
    return this.objectives.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateActivityObjectiveDto) {
    return this.objectives.update(id, dto);
  }

  @Roles(...WRITE)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.objectives.deactivate(id);
  }
}
