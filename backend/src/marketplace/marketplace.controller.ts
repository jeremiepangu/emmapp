import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QuoteRequestStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private marketplace: MarketplaceService) {}

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.COMMERCIAL, UserRole.DELEGUE_COMMERCIAL)
  @Get('quote-requests')
  list(@Query('status') status?: string) {
    return this.marketplace.findAll(status);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.DELEGUE_COMMERCIAL)
  @Post('quote-requests')
  create(@Body() body: Parameters<MarketplaceService['create']>[0]) {
    return this.marketplace.create(body);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Patch('quote-requests/:id')
  update(
    @Param('id') id: string,
    @Body() body: { status?: QuoteRequestStatus; quotedAmount?: number },
    @Req() req: { user: { id: string } },
  ) {
    return this.marketplace.update(id, req.user.id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @Post('quote-requests/:id/convert')
  convert(@Param('id') id: string) {
    return this.marketplace.convert(id);
  }
}
