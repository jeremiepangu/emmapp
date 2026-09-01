import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RecouvrementFilter, RecouvrementService } from './recouvrement.service';

@ApiTags('recouvrement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recouvrement')
export class RecouvrementController {
  constructor(private recouvrement: RecouvrementService) {}

  @Get()
  overview(
    @Query('filter') filter?: RecouvrementFilter,
    @Query('minAgeDays') minAgeDays?: string,
    @Query('search') search?: string,
  ) {
    return this.recouvrement.overview({
      filter,
      minAgeDays: minAgeDays ? Number(minAgeDays) : undefined,
      search: search?.trim() || undefined,
    });
  }

  @Get('clients/:clientId')
  situation(@Param('clientId') clientId: string) {
    return this.recouvrement.situation(clientId);
  }

  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.COMPTABLE, UserRole.CAISSIER, UserRole.CHEF_EXPLOITATION)
  @Post('clients/:clientId/relance')
  remind(@Param('clientId') clientId: string, @Body() body: { notes?: string }) {
    return this.recouvrement.remind(clientId, body?.notes);
  }
}
