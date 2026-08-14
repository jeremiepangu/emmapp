import { Injectable } from '@nestjs/common';
import { NotificationCategory, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

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
    return this.prisma.notification.create({ data });
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
