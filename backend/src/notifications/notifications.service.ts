import { Injectable } from '@nestjs/common';
import { NotificationCategory, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

/** La base locale Windows est en WIN1252 : tout caractère hors de cet encodage fait échouer l'INSERT. */
function toWin1252Safe(text: string): string {
  return text
    .replace(/[→⇒]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u2060\u3000\uFEFF]/g, ' ')
    .replace(/[^\u0000-\u00FF]/g, (ch) => {
      const allowed = new Set([
        0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192, 0x02c6, 0x02dc,
        0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021,
        0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
      ]);
      return allowed.has(ch.charCodeAt(0)) ? ch : '';
    });
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  findForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  create(data: {
    userId: string;
    title: string;
    message: string;
    type?: NotificationType;
    category?: NotificationCategory;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        ...data,
        title: toWin1252Safe(data.title),
        message: toWin1252Safe(data.message),
      },
    });
  }

  async notifyRoles(
    roles: UserRole[],
    payload: Omit<Parameters<NotificationsService['create']>[0], 'userId'>,
  ) {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    });
    return Promise.all(users.map((u) => this.create({ ...payload, userId: u.id })));
  }
}
