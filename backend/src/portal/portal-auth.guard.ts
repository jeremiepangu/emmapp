import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException();
    let payload: { sub?: string; type?: string; clientId?: string; email?: string };
    try {
      payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET || 'dev-secret' });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'portal' || !payload.sub) throw new UnauthorizedException();
    const account = await this.prisma.portalAccount.findUnique({ where: { id: payload.sub } });
    if (!account?.isActive) throw new UnauthorizedException();
    req.portal = { accountId: account.id, clientId: account.clientId, email: account.email };
    return true;
  }
}
