import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthorizationsService } from '../../authorizations/authorizations.service';
import { mapRequestToAcl } from '../../authorizations/acl.catalog';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizations: AuthorizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id?: string; role?: UserRole } | undefined;
    if (!user?.role) {
      throw new UnauthorizedException();
    }
    if (user.role === UserRole.ADMIN) return true;
    if (requiredRoles.includes(user.role)) return true;

    const mapped = mapRequestToAcl(request.method, request.originalUrl || request.url || '');
    if (mapped && user.id) {
      try {
        return await this.authorizations.can(user.id, user.role, mapped.resource, mapped.action);
      } catch {
        return false;
      }
    }

    return false;
  }
}
