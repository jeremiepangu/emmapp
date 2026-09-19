import { Injectable, Logger } from '@nestjs/common';
import { NotificationCategory, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private prisma: PrismaService) {}

  async sendNotification(row: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    link?: string | null;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { phone: true, firstName: true, isActive: true },
    });
    if (!user?.isActive) return;
    const to = this.toE164(user.phone);
    if (!to) return;
    const prefs = await this.prisma.$queryRaw<Array<{ whatsapp_notifications: boolean }>>`
      SELECT whatsapp_notifications FROM user_preferences WHERE user_id = ${row.userId}
    `;
    if (prefs[0]?.whatsapp_notifications === false) return;

    const base = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    const href = row.link
      ? `${base}${row.link.startsWith('/') ? '' : '/'}${row.link}`
      : `${base}/notifications`;
    const body = [
      `EMMANUEL SERVICES`,
      `${row.category} · ${row.type}`,
      row.title,
      row.message,
      `Bonjour ${user.firstName}, ouvrez EMMAPP : ${href}`,
    ].join('\n');

    await this.send(to, body, { title: row.title, message: row.message });
  }

  async send(to: string, body: string, vars?: { title: string; message: string }) {
    if (this.metaConfigured()) {
      await this.sendViaMeta(to, body, vars);
      return;
    }
    if (this.twilioConfigured()) {
      await this.sendViaTwilio(to, body);
      return;
    }
    this.logger.log(`WhatsApp (API non configuree) -> ${to} | ${body.replace(/\n/g, ' | ')}`);
  }

  private metaConfigured() {
    return Boolean((process.env.WHATSAPP_TOKEN ?? '').trim() && (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim());
  }

  private twilioConfigured() {
    return Boolean(
      (process.env.TWILIO_ACCOUNT_SID ?? '').trim() &&
        (process.env.TWILIO_AUTH_TOKEN ?? '').trim() &&
        (process.env.TWILIO_WHATSAPP_FROM ?? '').trim(),
    );
  }

  private async sendViaMeta(to: string, body: string, vars?: { title: string; message: string }) {
    const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
    const version = (process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0').trim();
    const template = (process.env.WHATSAPP_TEMPLATE ?? '').trim();
    const payload = template
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: template,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'fr' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: this.clip(vars?.title ?? body) },
                  { type: 'text', text: this.clip(vars?.message ?? body) },
                ],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: this.clip(body, 4096) },
        };

    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Meta WhatsApp ${response.status}: ${detail.slice(0, 300)}`);
    }
    this.logger.log(`WhatsApp envoye a ${to}`);
  }

  private async sendViaTwilio(to: string, body: string) {
    const sid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
    const from = this.twilioAddress(process.env.TWILIO_WHATSAPP_FROM ?? '');
    const params = new URLSearchParams({
      From: from,
      To: `whatsapp:+${to}`,
      Body: this.clip(body, 1600),
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Twilio WhatsApp ${response.status}: ${detail.slice(0, 300)}`);
    }
    this.logger.log(`WhatsApp envoye a ${to}`);
  }

  toE164(phone?: string | null) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    if (digits.startsWith('00') && digits.length > 10) return digits.slice(2);
    if (digits.startsWith('243')) return digits;
    if (digits.startsWith('0') && digits.length >= 9) return `243${digits.slice(1)}`;
    return digits;
  }

  private twilioAddress(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith('whatsapp:')) return trimmed;
    const e164 = this.toE164(trimmed);
    return e164 ? `whatsapp:+${e164}` : trimmed;
  }

  private clip(value: string, max = 1024) {
    const text = String(value ?? '').trim() || '-';
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }
}
