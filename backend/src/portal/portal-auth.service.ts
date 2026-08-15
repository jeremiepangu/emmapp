import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  fullName: true,
  clientId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  client: { select: { code: true, name: true, segment: true } },
} as const;

@Injectable()
export class PortalAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const account = await this.prisma.portalAccount.findUnique({ where: { email } });
    if (!account?.isActive) throw new UnauthorizedException('Identifiants invalides');
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');
    await this.prisma.portalAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });
    const safe = await this.prisma.portalAccount.findUnique({
      where: { id: account.id },
      select: ACCOUNT_SELECT,
    });
    const accessToken = this.jwt.sign(
      { sub: account.id, clientId: account.clientId, email: account.email, type: 'portal', role: 'CLIENT_PORTAIL' },
      { expiresIn: '12h' },
    );
    return { accessToken, account: safe };
  }
}

export { ACCOUNT_SELECT };
