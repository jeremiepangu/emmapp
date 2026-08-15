import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.module';

export const WEBHOOK_EVENTS = [
  'commande.creee',
  'commande.validee',
  'livraison.effectuee',
  'paiement.enregistre',
  'lot.libere',
  'cotation.recue',
] as const;

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async dispatch(event: string, payload: Record<string, unknown>): Promise<void> {
    const subs = await this.prisma.webhookSubscription.findMany({
      where: { isActive: true, events: { has: event } },
    });
    await Promise.all(subs.map((sub) => this.deliver(sub.id, sub.url, sub.secret, event, payload)));
  }

  async deliver(subscriptionId: string, url: string, secret: string, event: string, payload: Record<string, unknown>) {
    const body = JSON.stringify({ event, payload, at: new Date().toISOString() });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emmas-Event': event,
          'X-Emmas-Signature': signature,
        },
        body,
        signal: controller.signal,
      });
      statusCode = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : 'échec réseau';
    } finally {
      clearTimeout(timer);
    }
    return this.prisma.webhookDelivery.create({
      data: {
        subscriptionId,
        event,
        payload: payload as Prisma.InputJsonValue,
        statusCode,
        error,
        attempts: 1,
        deliveredAt: statusCode && statusCode < 400 ? new Date() : null,
      },
    });
  }
}
