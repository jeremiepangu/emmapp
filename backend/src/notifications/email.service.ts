import { Injectable, Logger } from '@nestjs/common';
import { NotificationCategory, NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

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
      select: { email: true, firstName: true, lastName: true, isActive: true },
    });
    if (!user?.isActive || !user.email) return;
    const preference = await this.prisma.userPreference.findUnique({
      where: { userId: row.userId },
    });
    if ((preference as { emailNotifications?: boolean } | null)?.emailNotifications === false) return;

    const subject = `[EMMANUEL SERVICES] ${row.title}`;
    const html = this.renderHtml({
      firstName: user.firstName,
      title: row.title,
      message: row.message,
      category: row.category,
      type: row.type,
      link: row.link,
    });
    await this.send(user.email, subject, html);
  }

  async send(to: string, subject: string, html: string) {
    const host = (process.env.SMTP_HOST ?? '').trim();
    if (!host) {
      this.logger.log(`Email (SMTP non configure) -> ${to} | ${subject}`);
      return;
    }
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'EMMANUEL SERVICES <noreply@emmas.cd>',
      to,
      subject,
      html,
      text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    this.logger.log(`Email envoye a ${to} | ${subject}`);
  }

  private renderHtml(params: {
    firstName: string;
    title: string;
    message: string;
    category: string;
    type: string;
    link?: string | null;
  }) {
    const base = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    const href = params.link ? `${base}${params.link.startsWith('/') ? '' : '/'}${params.link}` : `${base}/notifications`;
    return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #d9dee3;border-radius:4px;">
        <tr><td style="background:#0b4f6c;color:#ffffff;padding:16px 24px;font-size:16px;font-weight:bold;">EMMANUEL SERVICES SARLU</td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px;">Bonjour ${this.esc(params.firstName)},</p>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.06em;color:#6b7280;">${this.esc(params.category)} · ${this.esc(params.type)}</p>
          <h1 style="margin:0 0 12px;font-size:20px;">${this.esc(params.title)}</h1>
          <p style="margin:0 0 20px;line-height:1.5;">${this.esc(params.message)}</p>
          <p style="margin:0;"><a href="${this.esc(href)}" style="display:inline-block;background:#0b4f6c;color:#ffffff;text-decoration:none;padding:10px 16px;">Ouvrir dans EMMAPP</a></p>
        </td></tr>
        <tr><td style="padding:16px 24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
          Kinshasa, Bandalungwa · contact@emmas.cd · www.emmas.cd
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private esc(value: string) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
