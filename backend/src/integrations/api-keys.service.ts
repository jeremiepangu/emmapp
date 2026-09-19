import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationCategory, NotificationType, UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from './webhooks.service';

@Injectable()
export class ApiKeysService {
  constructor(
    private prisma: PrismaService,
    private webhooks: WebhooksService,
    private notifications: NotificationsService,
  ) {}

  listKeys() {
    return this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        partner: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async createKey(data: { label: string; partner: string; scopes: string[] }) {
    const secret = randomBytes(24).toString('hex');
    const prefix = randomBytes(4).toString('hex');
    const key = `emmas_${prefix}_${secret}`;
    const keyHash = createHash('sha256').update(key).digest('hex');
    const record = await this.prisma.apiKey.create({
      data: {
        label: data.label,
        partner: data.partner,
        keyPrefix: prefix,
        keyHash,
        scopes: data.scopes,
      },
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.IT_GED],
      {
        title: 'Cle API creee',
        message: `${record.label} — ${record.partner}`,
        type: NotificationType.WARNING,
        category: NotificationCategory.SECURITE,
        link: '/integrations',
      },
    );
    return {
      id: record.id,
      label: record.label,
      partner: record.partner,
      keyPrefix: record.keyPrefix,
      scopes: record.scopes,
      isActive: record.isActive,
      lastUsedAt: record.lastUsedAt,
      createdAt: record.createdAt,
      key,
    };
  }

  async revoke(id: string) {
    await this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
  }

  listWebhooks() {
    return this.prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deliveries: true } } },
    }).then((rows) => rows.map(({ secret: _secret, _count, ...rest }) => ({
      ...rest,
      deliveriesCount: _count.deliveries,
    })));
  }

  async createWebhook(data: { label: string; url: string; events: string[] }) {
    if (!/^https?:\/\//i.test(data.url)) {
      throw new Error('URL webhook invalide');
    }
    const created = await this.prisma.webhookSubscription.create({
      data: {
        label: data.label,
        url: data.url,
        events: data.events,
        secret: randomBytes(16).toString('hex'),
      },
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.IT_GED],
      {
        title: 'Webhook cree',
        message: `${created.label} — ${created.url}`,
        type: NotificationType.INFO,
        category: NotificationCategory.SYSTEME,
        link: '/integrations',
      },
    );
    const { secret: _s, ...rest } = created;
    return rest;
  }

  async deleteWebhook(id: string) {
    await this.prisma.webhookSubscription.delete({ where: { id } });
  }

  async testWebhook(id: string) {
    const sub = await this.prisma.webhookSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Abonnement introuvable');
    return this.webhooks.deliver(sub.id, sub.url, sub.secret, 'commande.creee', { test: true });
  }

  deliveries(id: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
