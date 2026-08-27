import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreatePackagingMovementDto,
  CreatePackagingSkuDto,
  PackagingQueryDto,
  UpdatePackagingMovementDto,
  UpdatePackagingSkuDto,
} from './dto/packaging.dto';
import { PackagingService } from './packaging.service';

@ApiTags('packaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('packaging')
export class PackagingController {
  constructor(private packagingService: PackagingService) {}

  @Get()
  listSkus(@Query() query: PackagingQueryDto) {
    return this.packagingService.listSkus(query.kind, query.format);
  }

  @Get('summary')
  summary() {
    return this.packagingService.summary();
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_PRODUCTION)
  @Post('skus')
  createSku(@Body() dto: CreatePackagingSkuDto) {
    return this.packagingService.createSku(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_PRODUCTION)
  @Patch('skus/:id')
  updateSku(@Param('id') id: string, @Body() dto: UpdatePackagingSkuDto) {
    return this.packagingService.updateSku(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete('skus/:id')
  deactivateSku(@Param('id') id: string) {
    return this.packagingService.deactivateSku(id);
  }

  @Get('movements')
  listMovements(@Query() query: PackagingQueryDto) {
    return this.packagingService.listMovements(query);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_PRODUCTION)
  @Post('movements')
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreatePackagingMovementDto,
  ) {
    return this.packagingService.recordMovement(dto, req.user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_PRODUCTION)
  @Patch('movements/:id')
  updateMovement(@Param('id') id: string, @Body() dto: UpdatePackagingMovementDto) {
    return this.packagingService.updateMovement(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @Delete('movements/:id')
  remove(@Param('id') id: string) {
    return this.packagingService.removeMovement(id);
  }
}
