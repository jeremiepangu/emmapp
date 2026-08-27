import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientSegment, NotificationCategory, NotificationType, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';
import { RegisterPortalDto } from './dto/register-portal.dto';

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
    private notifications: NotificationsService,
  ) {}

  async login(email: string, password: string) {
    const normalized = email.trim();
    const account =
      await this.prisma.portalAccount.findUnique({ where: { email: normalized.toLowerCase() } })
      ?? (normalized !== normalized.toLowerCase()
        ? await this.prisma.portalAccount.findUnique({ where: { email: normalized } })
        : null);
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
    return { accessToken: this.signPortal(account), account: safe };
  }

  async register(dto: RegisterPortalDto) {
    const email = dto.email;
    const existing = await this.prisma.portalAccount.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Cet e-mail est deja utilise');

    const name = dto.companyName || dto.fullName;
    const segment = dto.segment ?? ClientSegment.PARTICULIER;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const code = `WEB-${date}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const address = [dto.avenue, dto.quartier, dto.commune, 'KINSHASA'].filter(Boolean).join(', ');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    let account;
    try {
      account = await this.prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            code,
            name,
            segment,
            phone: dto.phone,
            email,
            commune: dto.commune,
            quartier: dto.quartier,
            avenue: dto.avenue,
            district: dto.district,
            province: 'KINSHASA',
            city: 'Kinshasa',
            zone: dto.commune,
            address,
          },
        });
        return tx.portalAccount.create({
          data: {
            email,
            passwordHash,
            fullName: dto.fullName,
            clientId: client.id,
            lastLoginAt: new Date(),
          },
          select: ACCOUNT_SELECT,
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Cet e-mail est deja utilise');
      }
      throw err;
    }

    await this.notifications.notifyRoles(
      [UserRole.COMMERCIAL, UserRole.ADMIN],
      {
        title: 'Nouveau client portail',
        message: `${name} (${email}) s'est inscrit depuis le site.`,
        type: NotificationType.INFO,
        category: NotificationCategory.PORTAIL,
        link: '/clients',
      },
    );

    return { accessToken: this.signPortal(account), account };
  }

  private signPortal(account: { id: string; clientId: string; email: string }) {
    return this.jwt.sign(
      { sub: account.id, clientId: account.clientId, email: account.email, type: 'portal', role: 'CLIENT_PORTAIL' },
      { expiresIn: '12h' },
    );
  }
}

export { ACCOUNT_SELECT };
