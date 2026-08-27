import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AclAction, AclMatrix } from './acl.catalog';
import { AuthorizationsService } from './authorizations.service';

@ApiTags('authorizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('authorizations')
export class AuthorizationsController {
  constructor(private authorizations: AuthorizationsService) {}

  @Get('me')
  mine(@Req() req: { user: { id: string; role: UserRole } }) {
    return this.authorizations.mine(req.user.id, req.user.role);
  }

  @Get('catalog')
  catalog() {
    return this.authorizations.catalog();
  }

  @Roles(UserRole.ADMIN, UserRole.RH, UserRole.RESP_SECURITE, UserRole.IT_GED, UserRole.DG)
  @Get('matrix')
  matrix() {
    return this.authorizations.matrix();
  }

  @Roles(UserRole.ADMIN, UserRole.RH, UserRole.RESP_SECURITE)
  @Put('roles/:role')
  saveRole(@Param('role') role: UserRole, @Body() body: { matrix: AclMatrix }) {
    return this.authorizations.saveRole(role, body.matrix ?? {});
  }

  @Roles(UserRole.ADMIN)
  @Post('roles/:role/reset')
  resetRole(@Param('role') role: UserRole) {
    return this.authorizations.resetRole(role);
  }

  @Roles(UserRole.ADMIN)
  @Post('reset')
  resetAll() {
    return this.authorizations.resetAllRoles();
  }

  @Roles(UserRole.ADMIN, UserRole.RH, UserRole.RESP_SECURITE, UserRole.IT_GED, UserRole.DG)
  @Get('users/:userId')
  userOverrides(@Param('userId') userId: string) {
    return this.authorizations.userOverrides(userId);
  }

  @Roles(UserRole.ADMIN, UserRole.RH, UserRole.RESP_SECURITE)
  @Put('users/:userId')
  saveUserOverrides(
    @Param('userId') userId: string,
    @Body() body: { overrides: Array<{ resource: string; action: AclAction; effect: 'GRANT' | 'DENY' }> },
  ) {
    return this.authorizations.saveUserOverrides(userId, body.overrides ?? []);
  }
}
