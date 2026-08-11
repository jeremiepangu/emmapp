import { Injectable } from '@nestjs/common';
import { SyncStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { PaymentsService } from '../payments/payments.service';
import { SyncBatchDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private deliveriesService: DeliveriesService,
    private paymentsService: PaymentsService,
  ) {}

  async pushBatch(userId: string, deviceId: string, dto: SyncBatchDto) {
    const results: Array<{
      localId: string;
      entityType: string;
      status: SyncStatus;
      serverId?: string;
      error?: string;
    }> = [];

    for (const item of dto.items) {
      try {
        const existing = await this.prisma.syncEvent.findFirst({
          where: { localId: item.localId, deviceId, status: SyncStatus.SYNCED },
        });

        if (existing) {
          results.push({
            localId: item.localId,
            entityType: item.entityType,
            status: SyncStatus.SYNCED,
            serverId: existing.entityId,
          });
          continue;
        }

        let serverId: string;

        if (item.entityType === 'delivery') {
          const delivery = await this.deliveriesService.create(
            item.payload as never,
            userId,
          );
          serverId = delivery.id;
        } else if (item.entityType === 'payment') {
          const payment = await this.paymentsService.create(
            item.payload as never,
            userId,
          );
          serverId = payment.id;
        } else {
          throw new Error(`Type non supporté: ${item.entityType}`);
        }

        await this.prisma.syncEvent.create({
          data: {
            userId,
            deviceId,
            entityType: item.entityType,
            entityId: serverId,
            localId: item.localId,
            payload: item.payload as object,
            status: SyncStatus.SYNCED,
            syncedAt: new Date(),
          },
        });

        results.push({
          localId: item.localId,
          entityType: item.entityType,
          status: SyncStatus.SYNCED,
          serverId,
        });
      } catch (err) {
        await this.prisma.syncEvent.create({
          data: {
            userId,
            deviceId,
            entityType: item.entityType,
            entityId: item.localId,
            localId: item.localId,
            payload: item.payload as object,
            status: SyncStatus.FAILED,
          },
        });

        results.push({
          localId: item.localId,
          entityType: item.entityType,
          status: SyncStatus.FAILED,
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }
    }

    return { results, syncedAt: new Date().toISOString() };
  }

  async pullUpdates(since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);

    const [clients, products, tours, orders] = await Promise.all([
      this.prisma.client.findMany({
        where: { updatedAt: { gte: sinceDate }, isActive: true },
      }),
      this.prisma.product.findMany({
        where: { updatedAt: { gte: sinceDate }, isActive: true },
      }),
      this.prisma.tour.findMany({
        where: { updatedAt: { gte: sinceDate } },
        include: {
          orders: {
            include: {
              client: true,
              lines: { include: { product: true } },
            },
          },
          vehicle: true,
        },
      }),
      this.prisma.order.findMany({
        where: { updatedAt: { gte: sinceDate } },
        include: {
          client: true,
          lines: { include: { product: true } },
        },
      }),
    ]);

    return {
      clients,
      products,
      tours,
      orders,
      pulledAt: new Date().toISOString(),
    };
  }
}
