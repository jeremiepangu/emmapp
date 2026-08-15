import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RouteStop, RoutingService } from './routing.service';

/**
 * Itinéraire optimisé d'une tournée. Les chemins sont préfixés par « tours » conformément
 * au contrat d'API et ne recouvrent aucune route du module Tournées.
 */
@ApiTags('routing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tours')
export class TourRouteController {
  constructor(private routingService: RoutingService) {}

  @Roles(
    UserRole.ADMIN,
    UserRole.DG,
    UserRole.CHEF_EXPLOITATION,
    UserRole.CHARGE_EXPLOITATION,
    UserRole.LIVREUR,
    UserRole.CHARGE_LIVRAISON,
    UserRole.SUPERVISEUR,
    UserRole.DATA_ANALYST,
    UserRole.RESP_DURABILITE,
  )
  @Get(':id/optimized-route')
  findForTour(@Param('id') id: string) {
    return this.routingService.findForTour(id);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Post(':id/optimized-route')
  compute(@Param('id') id: string) {
    return this.routingService.compute(id);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Patch(':id/optimized-route')
  adjust(@Param('id') id: string, @Body() body: { stops: RouteStop[] }) {
    return this.routingService.adjust(id, body?.stops);
  }

  @Roles(UserRole.ADMIN, UserRole.CHEF_EXPLOITATION)
  @Post(':id/optimized-route/apply')
  apply(@Param('id') id: string) {
    return this.routingService.apply(id);
  }
}
