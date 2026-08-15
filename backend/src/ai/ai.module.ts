import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiController } from './ai.controller';
import { AnomalyService } from './anomaly.service';
import { ForecastService } from './forecast.service';
import { MaintenanceService } from './maintenance.service';
import { ScoringService } from './scoring.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AiController],
  providers: [ForecastService, AnomalyService, MaintenanceService, ScoringService],
  exports: [ForecastService, AnomalyService, MaintenanceService, ScoringService],
})
export class AiModule {}
