import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSensorInput, IngestBatch, IotService, UpdateSensorInput } from './iot.service';
import { TelemetryService } from './telemetry.service';

/** Profils disposant de la lecture sur la ressource « iot » (matrice d'habilitation v3.0). */
const IOT_READ = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.CHEF_PRODUCTION,
  UserRole.CHEF_EXPLOITATION,
  UserRole.CHARGE_EXPLOITATION,
  UserRole.RESP_QUALITE,
  UserRole.SUPERVISEUR,
  UserRole.IT_GED,
  UserRole.DATA_ANALYST,
  UserRole.RESP_DURABILITE,
];
const IOT_ADMIN = [UserRole.ADMIN, UserRole.IT_GED];
const IOT_UPDATE = [
  UserRole.ADMIN,
  UserRole.IT_GED,
  UserRole.CHEF_PRODUCTION,
  UserRole.RESP_QUALITE,
];
const IOT_MANUAL_READING = [
  UserRole.ADMIN,
  UserRole.IT_GED,
  UserRole.RESP_QUALITE,
  UserRole.CHEF_PRODUCTION,
  UserRole.CHARGE_EXPLOITATION,
];

@ApiTags('iot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('iot')
export class IotController {
  constructor(
    private iotService: IotService,
    private telemetryService: TelemetryService,
  ) {}

  @Roles(...IOT_READ)
  @Get('sensors')
  getSensors(@Query('kind') kind?: string) {
    return this.iotService.findSensors(kind);
  }

  @Roles(...IOT_ADMIN)
  @Post('sensors')
  createSensor(@Body() body: CreateSensorInput) {
    return this.iotService.createSensor(body);
  }

  @Roles(...IOT_UPDATE)
  @Patch('sensors/:id')
  updateSensor(@Param('id') id: string, @Body() body: UpdateSensorInput) {
    return this.iotService.updateSensor(id, body);
  }

  @Roles(...IOT_ADMIN)
  @Delete('sensors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSensor(@Param('id') id: string) {
    return this.iotService.deleteSensor(id);
  }

  @Roles(...IOT_READ)
  @Get('sensors/:sensorId/readings')
  getReadings(@Param('sensorId') sensorId: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    return this.iotService.findReadings(sensorId, Number.isNaN(parsed) ? 50 : parsed);
  }

  @Roles(...IOT_MANUAL_READING)
  @Post('sensors/:sensorId/readings')
  createReading(@Param('sensorId') sensorId: string, @Body() body: { value: number }) {
    return this.iotService.createReading(sensorId, body.value);
  }

  @Roles(...IOT_ADMIN)
  @Post('ingest')
  ingest(@Body() body: IngestBatch) {
    return this.iotService.ingest(body);
  }

  @Roles(...IOT_READ)
  @Get('telemetry/vehicles')
  getVehicleTelemetry() {
    return this.telemetryService.getVehicleTelemetry();
  }

  @Roles(...IOT_READ)
  @Get('fountains')
  getFountains() {
    return this.telemetryService.getConnectedFountains();
  }
}
