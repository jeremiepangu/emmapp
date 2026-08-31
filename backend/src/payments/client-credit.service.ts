import { Injectable } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationType,
  OrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClientCreditService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * La dette en argent d'un client est la somme des restes a payer de ses
   * commandes actives. Au-dela du plafond, les equipes sont alertees.
   */
  async refresh(clientId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const orders = await db.order.findMany({
      where: { clientId, status: { not: OrderStatus.ANNULEE } },
      select: { totalAmount: true, paidAmount: true },
    });
    const balance = orders.reduce((sum, o) => {
      const remaining = new Prisma.Decimal(o.totalAmount).sub(o.paidAmount);
      return remaining.gt(0) ? sum.add(remaining) : sum;
    }, new Prisma.Decimal(0));

    const client = await db.client.update({
      where: { id: clientId },
      data: { creditBalance: balance },
    });

    if (Number(client.creditLimit) > 0 && balance.gt(client.creditLimit)) {
      void this.notifications
        .notifyRoles([UserRole.ADMIN, UserRole.COMPTABLE, UserRole.COMMERCIAL], {
          title: 'Plafond de credit depasse',
          message: `${client.name} : ${balance.toFixed(2)} / ${Number(client.creditLimit).toFixed(2)}`,
          type: NotificationType.WARNING,
          category: NotificationCategory.PAIEMENT,
          link: '/payments',
        })
        .catch(() => undefined);
    }
    return balance;
  }
}
