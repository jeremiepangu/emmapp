import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PosAdvanceDto, PosAcompteDto, PosCheckoutDto, PosQuoteDto } from './dto/pos.dto';
import { PosService } from './pos.service';

const READ = [
  UserRole.ADMIN,
  UserRole.CAISSIER,
  UserRole.COMMERCIAL,
  UserRole.DG,
  UserRole.COMPTABLE,
  UserRole.CHEF_EXPLOITATION,
  UserRole.DELEGUE_COMMERCIAL,
] as const;

const WRITE = [UserRole.ADMIN, UserRole.CAISSIER, UserRole.COMMERCIAL] as const;

@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pos')
export class PosController {
  constructor(private pos: PosService) {}

  @Roles(...READ)
  @Get('catalog')
  catalog() {
    return this.pos.catalog();
  }

  @Roles(...READ)
  @Get('sales')
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cashierId') cashierId?: string,
  ) {
    return this.pos.list({ from, to, cashierId });
  }

  @Roles(...WRITE)
  @Post('quote')
  quote(@Body() dto: PosQuoteDto) {
    return this.pos.quote(dto.clientId, dto.lines);
  }

  @Roles(...WRITE)
  @Post('checkout')
  checkout(@Body() dto: PosCheckoutDto, @Req() req: { user: { id: string } }) {
    return this.pos.checkout(dto, req.user.id);
  }

  @Roles(...WRITE)
  @Post('advance')
  advance(@Body() dto: PosAdvanceDto, @Req() req: { user: { id: string } }) {
    return this.pos.recordAdvance(dto, req.user.id);
  }

  @Roles(...WRITE)
  @Post('acompte')
  acompte(@Body() dto: PosAcompteDto, @Req() req: { user: { id: string } }) {
    return this.pos.recordAcompte(dto, req.user.id);
  }

  @Roles(...READ)
  @Get('sales/:id')
  findOne(@Param('id') id: string) {
    return this.pos.findOne(id);
  }

  @Roles(...WRITE)
  @Post('sales/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.pos.cancel(id);
  }
}
