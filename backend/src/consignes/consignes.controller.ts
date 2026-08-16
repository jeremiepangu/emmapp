import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Get('client/:clientId')
  getClientHistory(@Param('clientId') clientId: string) {
    return this.consignesService.getClientHistory(clientId);
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

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.consignesService.remove(id);
  }
}
