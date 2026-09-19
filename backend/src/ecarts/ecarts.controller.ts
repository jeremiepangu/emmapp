import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DiscrepancyKind, DiscrepancyStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CashClosingService } from './cash-closing.service';
import { DiscrepanciesService } from './discrepancies.service';
import { TourReconciliationService } from './tour-reconciliation.service';

const READ = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.COMPTABLE,
  UserRole.CHEF_EXPLOITATION,
  UserRole.CAISSIER,
] as const;

const WRITE = [UserRole.ADMIN, UserRole.COMPTABLE, UserRole.CHEF_EXPLOITATION] as const;

@ApiTags('ecarts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ecarts')
export class EcartsController {
  constructor(
    private discrepancies: DiscrepanciesService,
    private cashClosing: CashClosingService,
    private tourReconciliation: TourReconciliationService,
  ) {}

  @Roles(...READ)
  @Get()
  list(@Query('kind') kind?: DiscrepancyKind, @Query('status') status?: DiscrepancyStatus) {
    return this.discrepancies.findAll({ kind, status });
  }

  @Roles(...READ)
  @Get('summary')
  summary() {
    return this.discrepancies.summary();
  }

  @Roles(...WRITE)
  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: { status: DiscrepancyStatus; notes?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.discrepancies.resolve(id, body.status, req.user.id, body.notes);
  }

  @Roles(...READ)
  @Get('cash-closings')
  closings(@Query('cashierId') cashierId?: string) {
    return this.cashClosing.findAll({ cashierId });
  }

  @Roles(UserRole.ADMIN, UserRole.CAISSIER, UserRole.COMPTABLE)
  @Get('cash-closings/current')
  currentClosing(@Req() req: { user: { id: string } }) {
    return this.cashClosing.current(req.user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.CAISSIER)
  @Post('cash-closings/open')
  openClosing(@Body() body: { notes?: string }, @Req() req: { user: { id: string } }) {
    return this.cashClosing.open(req.user.id, body?.notes);
  }

  @Roles(UserRole.ADMIN, UserRole.CAISSIER)
  @Post('cash-closings/:id/close')
  closeClosing(@Param('id') id: string, @Body() body: { countedAmount: number; notes?: string }) {
    return this.cashClosing.close(id, body.countedAmount, body.notes);
  }

  @Roles(...WRITE)
  @Post('cash-closings/:id/validate')
  validateClosing(@Param('id') id: string) {
    return this.cashClosing.validate(id);
  }

  @Roles(...READ)
  @Get('tours/:tourId')
  tourPreview(@Param('tourId') tourId: string) {
    return this.tourReconciliation.preview(tourId);
  }

  @Roles(...WRITE)
  @Post('tours/:tourId/reconcile')
  tourReconcile(@Param('tourId') tourId: string) {
    return this.tourReconciliation.reconcile(tourId);
  }
}
