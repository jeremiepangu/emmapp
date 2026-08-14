import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.SUPERVISEUR, UserRole.MAGASINIER, UserRole.CHEF_EXPLOITATION, UserRole.CHEF_PRODUCTION, UserRole.COMPTABLE)
  @Get('overview')
  overview() {
    return this.dashboardService.getOverview();
  }
}
