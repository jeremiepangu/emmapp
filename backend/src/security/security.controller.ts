import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MfaService } from './mfa.service';
import { SecurityService } from './security.service';

const SEC_READ = [UserRole.ADMIN, UserRole.DG, UserRole.SUPERVISEUR, UserRole.IT_GED, UserRole.RESP_SECURITE];

@ApiTags('security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(
    private security: SecurityService,
    private mfa: MfaService,
  ) {}

  @Roles(...SEC_READ)
  @Get('center/alerts')
  alerts(@Query('status') status?: string) {
    return this.security.findAlerts(status);
  }

  @Roles(UserRole.ADMIN, UserRole.RESP_SECURITE)
  @Patch('center/alerts/:id')
  updateAlert(@Param('id') id: string, @Body() body: { status: string }) {
    return this.security.updateAlert(id, body.status);
  }

  @Roles(...SEC_READ)
  @Get('center/summary')
  summary() {
    return this.security.summary();
  }

  @Roles(...SEC_READ)
  @Get('center/audit')
  audit(@Query('limit') limit?: string) {
    return this.security.findAudit(Number(limit) || 100);
  }

  @Get('mfa/status')
  mfaStatus(@Req() req: { user: { id: string; role: UserRole } }) {
    return this.mfa.status(req.user.id, req.user.role);
  }

  @Post('mfa/setup')
  mfaSetup(@Req() req: { user: { id: string; email: string } }) {
    return this.mfa.setup(req.user.id, req.user.email);
  }

  @Post('mfa/confirm')
  mfaConfirm(@Req() req: { user: { id: string } }, @Body() body: { code: string }) {
    return this.mfa.confirm(req.user.id, body.code);
  }

  @Delete('mfa')
  mfaDisable(@Req() req: { user: { id: string; role: UserRole } }, @Body() body: { code: string }) {
    return this.mfa.disable(req.user.id, req.user.role, body.code);
  }

  @Post('step-up')
  stepUp(@Req() req: { user: { id: string } }, @Body() body: { code: string }) {
    return this.mfa.stepUp(req.user.id, body.code);
  }
}
