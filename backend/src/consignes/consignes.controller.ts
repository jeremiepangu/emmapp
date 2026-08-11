import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConsignesService } from './consignes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('consignes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consignes')
export class ConsignesController {
  constructor(private consignesService: ConsignesService) {}

  @Get('client/:clientId')
  getClientHistory(@Param('clientId') clientId: string) {
    return this.consignesService.getClientHistory(clientId);
  }
}
