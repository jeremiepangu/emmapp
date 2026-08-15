import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnomalySeverity, SecurityAlertKind, SecurityAlertStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

export const SENSITIVE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.RESP_SECURITE,
  UserRole.IT_GED,
  UserRole.COMPTABLE,
  UserRole.CAISSIER,
  UserRole.RH,
];

@Injectable()
export class SecurityService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  findAlerts(status?: string) {
    return this.prisma.securityAlert.findMany({
      where: status ? { status: status as SecurityAlertStatus } : undefined,
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateAlert(id: string, status: string) {
    const existing = await this.prisma.securityAlert.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Alerte introuvable');
    if (!(status in SecurityAlertStatus)) throw new BadRequestException('Statut invalide');
    return this.prisma.securityAlert.update({
      where: { id },
      data: { status: status as SecurityAlertStatus },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
  }

  async summary() {
    const since = new Date(Date.now() - 24 * 3600_000);
    const [
      openAlerts,
      criticalAlerts,
      failedLoginsLast24h,
      mfaEnabledCount,
      sensitiveAccountsCount,
      auditEventsLast24h,
    ] = await Promise.all([
      this.prisma.securityAlert.count({ where: { status: { not: SecurityAlertStatus.CLOTUREE } } }),
      this.prisma.securityAlert.count({
        where: { severity: AnomalySeverity.CRITIQUE, status: { not: SecurityAlertStatus.CLOTUREE } },
      }),
      this.prisma.securityAlert.count({
        where: { kind: SecurityAlertKind.ECHEC_AUTHENTIFICATION, createdAt: { gte: since } },
      }),
      this.prisma.mfaCredential.count({ where: { confirmed: true } }),
      this.prisma.user.count({ where: { isActive: true, role: { in: SENSITIVE_ROLES } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    ]);
    const mfaCoveragePct = sensitiveAccountsCount === 0 ? 0 : (mfaEnabledCount / sensitiveAccountsCount) * 100;
    return {
      openAlerts,
      criticalAlerts,
      failedLoginsLast24h,
      mfaEnabledCount,
      sensitiveAccountsCount,
      mfaCoveragePct,
      auditEventsLast24h,
    };
  }

  findAudit(limit = 100) {
    return this.prisma.auditLog.findMany({
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async recordFailedLogin(params: { email: string; ipAddress?: string; reason: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: params.email } });
    const since = new Date(Date.now() - 15 * 60_000);
    const recent = await this.prisma.securityAlert.count({
      where: {
        kind: SecurityAlertKind.ECHEC_AUTHENTIFICATION,
        email: params.email,
        createdAt: { gte: since },
      },
    });
    const severity = recent + 1 >= 5 ? AnomalySeverity.ELEVEE : AnomalySeverity.MOYENNE;
    await this.prisma.securityAlert.create({
      data: {
        kind: SecurityAlertKind.ECHEC_AUTHENTIFICATION,
        severity,
        source: 'auth',
        message: params.reason,
        email: params.email,
        ipAddress: params.ipAddress,
        userId: user?.id,
      },
    });
    if (severity === AnomalySeverity.ELEVEE) {
      await this.notifications.notifyRoles(
        [UserRole.RESP_SECURITE, UserRole.IT_GED, UserRole.ADMIN],
        {
          title: 'Tentatives de connexion répétées',
          message: `${params.email} : ${recent + 1} échecs en 15 minutes.`,
          type: NotificationType.ALERT,
          category: NotificationCategory.SECURITE,
          link: '/security',
        },
      );
    }
  }

  async recordSuccessfulLogin(params: { userId: string; email: string; ipAddress?: string }) {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: 'LOGIN',
        entityType: 'User',
        entityId: params.userId,
        ipAddress: params.ipAddress,
      },
    });
    const since = new Date(Date.now() - 15 * 60_000);
    const recentFails = await this.prisma.securityAlert.count({
      where: {
        kind: SecurityAlertKind.ECHEC_AUTHENTIFICATION,
        email: params.email,
        createdAt: { gte: since },
      },
    });
    if (recentFails > 0) {
      await this.prisma.securityAlert.create({
        data: {
          kind: SecurityAlertKind.ACTIVITE_ANORMALE,
          severity: AnomalySeverity.MOYENNE,
          source: 'auth',
          message: `Connexion réussie après ${recentFails} échec(s) récent(s).`,
          email: params.email,
          ipAddress: params.ipAddress,
          userId: params.userId,
        },
      });
    }
  }

  async recordAccessDenied(params: { userId?: string; email?: string; resource: string; ipAddress?: string }) {
    await this.prisma.securityAlert.create({
      data: {
        kind: SecurityAlertKind.ACCES_REFUSE,
        severity: AnomalySeverity.MOYENNE,
        source: params.resource,
        message: `Accès refusé à ${params.resource}`,
        email: params.email,
        ipAddress: params.ipAddress,
        userId: params.userId,
      },
    });
  }
}
