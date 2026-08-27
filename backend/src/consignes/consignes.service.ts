import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationCategory, NotificationType, ProductFormat, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConsignesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async recordMovement(params: {
    clientId: string;
    deliveryId?: string;
    productFormat: ProductFormat;
    qtyIn: number;
    qtyOut: number;
    notes?: string;
  }) {
    const client = await this.prisma.client.findUnique({
      where: { id: params.clientId },
    });
    if (!client) return null;

    const balanceAfter =
      client.consigneBalance + params.qtyOut - params.qtyIn;

    await this.prisma.client.update({
      where: { id: params.clientId },
      data: { consigneBalance: balanceAfter },
    });

    const movement = await this.prisma.consigneMovement.create({
      data: {
        clientId: params.clientId,
        deliveryId: params.deliveryId,
        productFormat: params.productFormat,
        qtyIn: params.qtyIn,
        qtyOut: params.qtyOut,
        balanceAfter,
        notes: params.notes,
      },
    });
    if (client.consigneLimit > 0 && balanceAfter >= client.consigneLimit * 0.9) {
      await this.notifications.notifyRoles(
        [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION],
        {
          title: 'Plafond consignes',
          message: `${client.name} : ${balanceAfter}/${client.consigneLimit}`,
          type: NotificationType.WARNING,
          category: NotificationCategory.CONSIGNE,
          link: '/consignes',
        },
      );
    }
    return movement;
  }

  getClientHistory(clientId: string) {
    return this.prisma.consigneMovement.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listRecent() {
    return this.prisma.consigneMovement.findMany({
      include: { client: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async update(
    id: string,
    data: { productFormat?: ProductFormat; qtyIn?: number; qtyOut?: number; notes?: string },
  ) {
    const movement = await this.prisma.consigneMovement.findUnique({ where: { id } });
    if (!movement) throw new NotFoundException('Mouvement introuvable');

    const qtyIn = data.qtyIn ?? movement.qtyIn;
    const qtyOut = data.qtyOut ?? movement.qtyOut;
    const client = await this.prisma.client.findUnique({ where: { id: movement.clientId } });
    if (!client) throw new NotFoundException('Client introuvable');

    const reverted = client.consigneBalance - movement.qtyOut + movement.qtyIn;
    const balanceAfter = reverted + qtyOut - qtyIn;

    await this.prisma.client.update({
      where: { id: movement.clientId },
      data: { consigneBalance: balanceAfter },
    });

    return this.prisma.consigneMovement.update({
      where: { id },
      data: {
        productFormat: data.productFormat,
        qtyIn,
        qtyOut,
        notes: data.notes,
        balanceAfter,
      },
      include: { client: { select: { name: true, code: true } } },
    });
  }

  async remove(id: string) {
    const movement = await this.prisma.consigneMovement.findUnique({ where: { id } });
    if (!movement) throw new NotFoundException('Mouvement introuvable');
    const client = await this.prisma.client.findUnique({ where: { id: movement.clientId } });
    if (client) {
      await this.prisma.client.update({
        where: { id: movement.clientId },
        data: { consigneBalance: client.consigneBalance - movement.qtyOut + movement.qtyIn },
      });
    }
    return this.prisma.consigneMovement.delete({ where: { id } });
  }
}
