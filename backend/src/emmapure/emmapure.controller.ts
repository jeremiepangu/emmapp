import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EmmapureService } from './emmapure.service';

@ApiTags('emmapure')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emmapure')
export class EmmapureController {
  constructor(private emmapureService: EmmapureService) {}

  @Roles(UserRole.ADMIN, UserRole.CHEF_PRODUCTION, UserRole.RESP_QUALITE, UserRole.DG, UserRole.SUPERVISEUR, UserRole.IT_GED)
  @Get('production')
  getProduction() {
    return this.emmapureService.getProductionOrders();
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_PRODUCTION)
  @Post('production')
  createProduction(@Body() body: { productFormat: string; lineCode: string; plannedQty: number }) {
    return this.emmapureService.createProductionOrder(body);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_PRODUCTION, UserRole.RESP_QUALITE)
  @Patch('production/:id/validate')
  validateProduction(@Param('id') id: string) {
    return this.emmapureService.validateProductionOrder(id);
  }

  @Roles(UserRole.ADMIN, UserRole.RESP_QUALITE, UserRole.CHEF_PRODUCTION, UserRole.DG, UserRole.SUPERVISEUR)
  @Get('quality')
  getQuality() {
    return this.emmapureService.getQualityChecks();
  }

  @Roles(UserRole.ADMIN, UserRole.RESP_QUALITE)
  @Post('quality')
  createQuality(@Body() body: Record<string, unknown>) {
    return this.emmapureService.createQualityCheck(body as never);
  }

  @Roles(UserRole.ADMIN, UserRole.RESP_QUALITE)
  @Patch('quality/:id/validate')
  validateQuality(
    @Param('id') id: string,
    @Body() body: { conform: boolean },
    @Req() req: { user: { id: string } },
  ) {
    return this.emmapureService.validateQualityCheck(id, body.conform, req.user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.DELEGUE_COMMERCIAL, UserRole.DG)
  @Get('loyalty')
  getLoyalty() {
    return this.emmapureService.getLoyaltyClients();
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Post('loyalty/:clientId/points')
  creditPoints(@Param('clientId') clientId: string, @Body() body: { points: number }) {
    return this.emmapureService.creditLoyalty(clientId, body.points);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Patch('loyalty/:clientId')
  updateLoyalty(
    @Param('clientId') clientId: string,
    @Body() body: { loyaltyPoints?: number; walletBalance?: number },
  ) {
    return this.emmapureService.updateLoyalty(clientId, body);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Post('loyalty/:clientId/reset')
  resetLoyalty(@Param('clientId') clientId: string) {
    return this.emmapureService.resetLoyalty(clientId);
  }

  @Roles(UserRole.ADMIN, UserRole.RH, UserRole.SUPERVISEUR, UserRole.DG)
  @Get('shifts')
  getShifts(@Query('date') date?: string) {
    return this.emmapureService.getShiftAssignments(date);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Post('shifts')
  createShift(@Body() body: Record<string, unknown>) {
    return this.emmapureService.createShiftAssignment(body as never);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Patch('shifts/:id')
  updateShift(
    @Param('id') id: string,
    @Body() body: Partial<{ date: string; startTime: string; endTime: string; postLabel: string; notes: string }>,
  ) {
    return this.emmapureService.updateShift(id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Patch('shifts/:id/validate')
  validateShift(@Param('id') id: string) {
    return this.emmapureService.validateShift(id);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Delete('shifts/:id')
  deleteShift(@Param('id') id: string) {
    return this.emmapureService.deleteShift(id);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_PRODUCTION)
  @Patch('production/:id')
  updateProduction(
    @Param('id') id: string,
    @Body() body: { producedQty?: number; lineCode?: string; plannedQty?: number },
  ) {
    return this.emmapureService.updateProduction(id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_PRODUCTION)
  @Delete('production/:id')
  deleteProduction(@Param('id') id: string) {
    return this.emmapureService.deleteProduction(id);
  }

  @Roles(UserRole.ADMIN, UserRole.RESP_QUALITE)
  @Patch('quality/:id')
  updateQuality(
    @Param('id') id: string,
    @Body()
    body: {
      lotNumber?: string;
      ph?: number;
      chlorineFree?: number;
      tds?: number;
      turbidity?: number;
      microbiologyOk?: boolean;
      notes?: string;
    },
  ) {
    return this.emmapureService.updateQuality(id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.RESP_QUALITE)
  @Delete('quality/:id')
  deleteQuality(@Param('id') id: string) {
    return this.emmapureService.deleteQuality(id);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.RESP_QUALITE, UserRole.CHEF_PRODUCTION)
  @Post('packaging')
  createPackaging(@Body() body: { barcode: string; productFormat: string; maxRotations: number }) {
    return this.emmapureService.createPackaging(body);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.RESP_QUALITE)
  @Patch('packaging/:id')
  updatePackaging(
    @Param('id') id: string,
    @Body() body: { rotationCount?: number; status?: string; maxRotations?: number },
  ) {
    return this.emmapureService.updatePackaging(id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete('packaging/:id')
  deletePackaging(@Param('id') id: string) {
    return this.emmapureService.deletePackaging(id);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION, UserRole.MAGASINIER)
  @Post('fountains')
  createFountain(
    @Body() body: { serialNumber: string; model?: string; contractType?: string; nextService?: string },
  ) {
    return this.emmapureService.createFountain(body);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION)
  @Patch('fountains/:id')
  updateFountain(
    @Param('id') id: string,
    @Body() body: { model?: string; contractType?: string; nextService?: string; isActive?: boolean },
  ) {
    return this.emmapureService.updateFountain(id, body);
  }

  @Roles(UserRole.ADMIN)
  @Delete('fountains/:id')
  deleteFountain(@Param('id') id: string) {
    return this.emmapureService.deleteFountain(id);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.RESP_QUALITE, UserRole.CHEF_PRODUCTION)
  @Get('packaging')
  getPackaging() {
    return this.emmapureService.getPackagingUnits();
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION)
  @Get('fountains')
  getFountains() {
    return this.emmapureService.getFountains();
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED, UserRole.SUPERVISEUR, UserRole.DG, UserRole.RESP_QUALITE)
  @Get('observability')
  getObservability() {
    return this.emmapureService.getObservability();
  }
}
