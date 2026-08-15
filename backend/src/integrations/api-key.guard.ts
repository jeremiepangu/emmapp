import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.module';

export const API_SCOPES_KEY = 'apiScopes';
export const ApiScopes = (...scopes: string[]) => SetMetadata(API_SCOPES_KEY, scopes);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = String(req.headers['x-api-key'] ?? '');
    if (!raw) throw new UnauthorizedException('Clé API manquante');
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const key = await this.prisma.apiKey.findFirst({ where: { keyHash, isActive: true } });
    if (!key) throw new UnauthorizedException('Clé API invalide');
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    const required = this.reflector.getAllAndOverride<string[]>(API_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    if (required.some((scope) => !key.scopes.includes(scope))) {
      throw new ForbiddenException('Périmètre insuffisant');
    }
    req.apiKey = { id: key.id, partner: key.partner, scopes: key.scopes };
    return true;
  }
}
