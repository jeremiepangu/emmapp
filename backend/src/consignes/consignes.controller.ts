import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductFormat, UserRole } from '@prisma/client';
import { ConsignesService } from './consignes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('consignes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consignes')
export class ConsignesController {
  constructor(private consignesService: ConsignesService) {}

  @Get()
  list() {
    return this.consignesService.listRecent();
  }

  @Get('debtors')
  debtors() {
    return this.consignesService.debtors();
  }

  @Get('situation')
  situation(@Query('filter') filter?: 'DEBITEUR' | 'CREDITEUR' | 'TOUS') {
    return this.consignesService.situation(filter ?? 'TOUS');
  }

  @Get('client/:clientId')
  getClientHistory(@Param('clientId') clientId: string) {
    return this.consignesService.getClientHistory(clientId);
  }

  @Get('client/:clientId/balances')
  balances(@Param('clientId') clientId: string) {
    return this.consignesService.balancesFor(clientId);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.COMMERCIAL, UserRole.CAISSIER)
  @Post('returns')
  recordReturn(
    @Body()
    body: {
      clientId: string;
      productFormat: ProductFormat;
      quantity: number;
      notes?: string;
    },
  ) {
    return this.consignesService.recordReturn(body);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.COMMERCIAL)
  @Post()
  create(
    @Body()
    body: {
      clientId: string;
      productFormat: ProductFormat;
      qtyIn: number;
      qtyOut: number;
      notes?: string;
    },
  ) {
    return this.consignesService.recordMovement(body);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.COMMERCIAL)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      productFormat?: ProductFormat;
      qtyIn?: number;
      qtyOut?: number;
      notes?: string;
    },
  ) {
    return this.consignesService.update(id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.consignesService.remove(id);
  }
}
