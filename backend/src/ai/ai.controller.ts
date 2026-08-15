import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AnomalyService } from './anomaly.service';
import { ForecastService } from './forecast.service';
import { MaintenanceService } from './maintenance.service';
import { ScoringService } from './scoring.service';

const AI_READ = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.CHEF_PRODUCTION,
  UserRole.CHEF_EXPLOITATION,
  UserRole.RESP_QUALITE,
  UserRole.MAGASINIER,
  UserRole.COMMERCIAL,
  UserRole.COMPTABLE,
  UserRole.SUPERVISEUR,
  UserRole.DATA_ANALYST,
  UserRole.RESP_SECURITE,
  UserRole.RESP_DURABILITE,
];
const AI_RUN = [UserRole.ADMIN, UserRole.DATA_ANALYST];

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private forecast: ForecastService,
    private anomalies: AnomalyService,
    private maintenance: MaintenanceService,
    private scoring: ScoringService,
  ) {}

  @Roles(...AI_READ)
  @Get('demand-forecast')
  getDemandForecast(@Query('zone') zone?: string, @Query('productId') productId?: string) {
    return this.forecast.findForecasts({ zone, productId });
  }

  @Roles(...AI_RUN)
  @Post('demand-forecast/run')
  runDemandForecast() {
    return this.forecast.run();
  }

  @Roles(...AI_READ)
  @Get('anomalies')
  getAnomalies(@Query('status') status?: string) {
    return this.anomalies.findAnomalies(status);
  }

  @Roles(...AI_RUN)
  @Post('anomalies/run')
  runAnomalies() {
    return this.anomalies.run();
  }

  @Roles(...AI_RUN)
  @Patch('anomalies/:id/status')
  updateAnomaly(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.anomalies.updateStatus(id, body.status, req.user.id);
  }

  @Roles(...AI_READ)
  @Get('maintenance-risk')
  getMaintenanceRisk() {
    return this.maintenance.findLatestRisks();
  }

  @Roles(...AI_RUN)
  @Post('maintenance-risk/run')
  runMaintenance() {
    return this.maintenance.run();
  }

  @Roles(...AI_READ)
  @Get('model-runs')
  getModelRuns() {
    return this.forecast.findModelRuns();
  }

  @Roles(...AI_READ)
  @Get('credit-score/:clientId')
  getCreditScore(@Param('clientId') clientId: string) {
    return this.scoring.creditScore(clientId);
  }

  @Roles(...AI_READ)
  @Get('recommendations/:clientId')
  getRecommendations(@Param('clientId') clientId: string) {
    return this.scoring.recommendations(clientId);
  }
}
