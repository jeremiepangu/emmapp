import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoutingService } from './routing.service';

@ApiTags('routing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('routing')
export class RoutingController {
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
  @Get('routes')
  listRoutes() {
    return this.routingService.listRoutes();
  }
}
