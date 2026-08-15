import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationCategory, NotificationType, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';
import { SENSITIVE_ROLES } from './security.service';
import { buildOtpauthUrl, generateCode, generateSecret, verifyCode } from './totp';

@Injectable()
export class MfaService {
  private readonly stepUps = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  static readonly SENSITIVE_ROLES = SENSITIVE_ROLES;

  async status(userId: string, role: UserRole) {
    const cred = await this.prisma.mfaCredential.findUnique({ where: { userId } });
    return {
      enabled: Boolean(cred),
      confirmed: Boolean(cred?.confirmed),
      sensitiveRole: SENSITIVE_ROLES.includes(role),
    };
  }

  async setup(userId: string, email: string) {
    const secret = generateSecret();
    await this.prisma.mfaCredential.upsert({
      where: { userId },
      update: { secret, confirmed: false, confirmedAt: null },
      create: { userId, secret, confirmed: false },
    });
    return {
      secret,
      otpauthUrl: buildOtpauthUrl({ issuer: 'EMMAPURE', email, secret }),
      currentCode: generateCode(secret),
    };
  }

  async confirm(userId: string, code: string) {
    const cred = await this.prisma.mfaCredential.findUnique({ where: { userId } });
    if (!cred) throw new BadRequestException('Aucun secret MFA à confirmer');
    if (!verifyCode(cred.secret, code)) throw new BadRequestException('Code invalide');
    await this.prisma.mfaCredential.update({
      where: { userId },
      data: { confirmed: true, confirmedAt: new Date() },
    });
    await this.notifications.create({
      userId,
      title: 'Second facteur activé',
      message: 'Votre compte est désormais protégé par un code temporaire.',
      type: NotificationType.SUCCESS,
      category: NotificationCategory.SECURITE,
      link: '/security',
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'MFA_CONFIRM', entityType: 'MfaCredential', entityId: userId },
    });
    return { confirmed: true };
  }

  async disable(userId: string, role: UserRole, code: string) {
    const cred = await this.prisma.mfaCredential.findUnique({ where: { userId } });
    if (!cred) throw new BadRequestException('MFA inactif');
    if (!verifyCode(cred.secret, code)) throw new BadRequestException('Code invalide');
    await this.prisma.mfaCredential.delete({ where: { userId } });
    if (SENSITIVE_ROLES.includes(role)) {
      await this.prisma.securityAlert.create({
        data: {
          kind: 'CONFORMITE',
          severity: 'ELEVEE',
          source: 'mfa',
          message: 'Un compte sensible a désactivé le second facteur.',
          userId,
        },
      });
    }
    return { disabled: true };
  }

  async stepUp(userId: string, code: string) {
    const ok = await this.verifyUserCode(userId, code);
    if (!ok) throw new BadRequestException('Code invalide');
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    this.stepUps.set(userId, expiresAt.getTime());
    return { verified: true, expiresAt: expiresAt.toISOString() };
  }

  hasRecentStepUp(userId: string): boolean {
    const exp = this.stepUps.get(userId);
    return Boolean(exp && exp > Date.now());
  }

  async isMfaRequired(userId: string, _role: UserRole): Promise<boolean> {
    const cred = await this.prisma.mfaCredential.findUnique({ where: { userId } });
    return Boolean(cred?.confirmed);
  }

  async verifyUserCode(userId: string, code: string): Promise<boolean> {
    const cred = await this.prisma.mfaCredential.findUnique({ where: { userId } });
    if (!cred?.confirmed) return false;
    return verifyCode(cred.secret, code);
  }
}
