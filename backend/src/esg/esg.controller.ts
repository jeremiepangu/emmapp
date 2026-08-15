import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EsgService } from './esg.service';

@ApiTags('esg')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('esg')
export class EsgController {
  constructor(private esgService: EsgService) {}

  @Roles(
    UserRole.ADMIN,
    UserRole.DG,
    UserRole.RESP_DURABILITE,
    UserRole.CHEF_EXPLOITATION,
    UserRole.SUPERVISEUR,
    UserRole.DATA_ANALYST,
  )
  @Get('dashboard')
  getDashboard() {
    return this.esgService.getDashboard();
  }

  @Roles(
    UserRole.ADMIN,
    UserRole.DG,
    UserRole.RESP_DURABILITE,
    UserRole.CHEF_EXPLOITATION,
    UserRole.SUPERVISEUR,
    UserRole.DATA_ANALYST,
  )
  @Get('indicators')
  getIndicators(@Query('scope') scope?: string) {
    return this.esgService.getIndicators(scope);
  }

  @Roles(UserRole.ADMIN, UserRole.RESP_DURABILITE)
  @Post('compute')
  compute() {
    return this.esgService.compute();
  }

  @Roles(
    UserRole.ADMIN,
    UserRole.DG,
    UserRole.RESP_DURABILITE,
    UserRole.CHEF_EXPLOITATION,
    UserRole.SUPERVISEUR,
    UserRole.DATA_ANALYST,
  )
  @Get('report')
  getReport(@Query('periodStart') periodStart?: string, @Query('periodEnd') periodEnd?: string) {
    return this.esgService.getReport(periodStart, periodEnd);
  }
}
