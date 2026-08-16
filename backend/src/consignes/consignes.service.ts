import { Injectable } from '@nestjs/common';
import { PaymentMethod, ProductFormat, SyncStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class ConsignesService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.consigneMovement.create({
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

  async remove(id: string) {
    return this.prisma.consigneMovement.delete({ where: { id } });
  }
}
