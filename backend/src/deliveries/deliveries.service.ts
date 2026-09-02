import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConsigneMovementSource,
  DeliveryStatus,
  DiscrepancyKind,
  NotificationCategory,
  NotificationType,
  Product,
  SyncStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { ConsignesService } from '../consignes/consignes.service';
import { DiscrepanciesService } from '../ecarts/discrepancies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDeliveryDto } from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(
    private prisma: PrismaService,
    private consignesService: ConsignesService,
    private discrepancies: DiscrepanciesService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Un contenant livre doit revenir en echange. Tout ecart entre les
   * contenants sortis et les vides rendus est journalise pour suivi.
   */
  private async recordEmptiesDiscrepancy(
    delivery: { id: string; deliveryNumber: string },
    clientId: string,
    product: Product,
    line: { qtyDelivered: number; qtyReturned?: number },
  ) {
    const expected = line.qtyDelivered;
    const actual = line.qtyReturned ?? 0;
    if (expected === actual) return;
    await this.discrepancies.record({
      kind: DiscrepancyKind.VIDANGE,
      reference: delivery.deliveryNumber,
      label: `${delivery.deliveryNumber} — ${product.name}`,
      expected,
      actual,
      clientId,
      productFormat: product.format,
    });
  }

  private async generateDeliveryNumber(): Promise<string> {
    const count = await this.prisma.delivery.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LIV-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  findAll(params?: { tourId?: string; driverId?: string }) {
    return this.prisma.delivery.findMany({
      where: {
        tourId: params?.tourId,
        driverId: params?.driverId,
      },
      include: {
        client: true,
        order: true,
        lines: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        client: true,
        order: true,
        tour: true,
        lines: { include: { product: true } },
        payments: true,
      },
    });
    if (!delivery) throw new NotFoundException('Livraison introuvable');
    return delivery;
  }

  async create(dto: CreateDeliveryDto, driverId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { client: true, lines: { include: { product: true } } },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    if (dto.localId) {
      const existing = await this.prisma.delivery.findUnique({
        where: { localId: dto.localId },
      });
      if (existing) return existing;
    }

    let netConsignes = 0;
    for (const line of dto.lines) {
      const product = order.lines.find((l) => l.productId === line.productId)?.product;
      if (product?.isReusable) {
        netConsignes += line.qtyDelivered - (line.qtyReturned ?? 0);
      }
    }
    await this.consignesService.assertWithinLimit(order.clientId, netConsignes);

    const delivery = await this.prisma.delivery.create({
      data: {
        deliveryNumber: await this.generateDeliveryNumber(),
        orderId: dto.orderId,
        clientId: order.clientId,
        tourId: dto.tourId,
        driverId,
        status: dto.status ?? DeliveryStatus.LIVREE,
        deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : new Date(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        signatureUrl: dto.signatureUrl,
        photoUrl: dto.photoUrl,
        clientCode: dto.clientCode,
        notes: dto.notes,
        localId: dto.localId,
        syncStatus: dto.localId ? SyncStatus.SYNCED : SyncStatus.SYNCED,
        lines: {
          create: dto.lines.map((line) => ({
            productId: line.productId,
            qtyDelivered: line.qtyDelivered,
            qtyReturned: line.qtyReturned ?? 0,
            qtyDamaged: line.qtyDamaged ?? 0,
            qtyRefused: line.qtyRefused ?? 0,
            unitPrice: line.unitPrice,
          })),
        },
      },
      include: {
        client: true,
        lines: { include: { product: true } },
      },
    });

    for (const line of dto.lines) {
      const product = order.lines.find((l) => l.productId === line.productId)?.product;
      if (!product?.isReusable) continue;
      await this.consignesService.recordMovement({
        clientId: order.clientId,
        deliveryId: delivery.id,
        orderId: order.id,
        productFormat: product.format,
        source: ConsigneMovementSource.LIVRAISON,
        qtyIn: line.qtyReturned ?? 0,
        qtyOut: line.qtyDelivered,
        unitValue: product.consigneAmount,
      });
      await this.recordEmptiesDiscrepancy(delivery, order.clientId, product, line);
    }

    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.CHEF_EXPLOITATION, UserRole.COMMERCIAL],
      {
        title: 'Livraison enregistree',
        message: `${delivery.deliveryNumber} — ${delivery.client.name}`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.LIVRAISON,
        link: '/deliveries',
      },
    );
    return delivery;
  }

  async getTourReconciliation(tourId: string) {
    const deliveries = await this.findAll({ tourId });
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      include: { loadSheets: true, vehicle: true },
    });

    let totalDelivered = 0;
    let totalReturned = 0;
    let totalRefused = 0;
    let totalDamaged = 0;

    for (const d of deliveries) {
      for (const line of d.lines) {
        totalDelivered += line.qtyDelivered;
        totalReturned += line.qtyReturned;
        totalRefused += line.qtyRefused;
        totalDamaged += line.qtyDamaged;
      }
    }

    return {
      tour,
      deliveries: deliveries.length,
      totals: {
        delivered: totalDelivered,
        returned: totalReturned,
        refused: totalRefused,
        damaged: totalDamaged,
      },
      loadSheets: tour?.loadSheets ?? [],
    };
  }

  async updateStatus(id: string, status: DeliveryStatus, notes?: string) {
    const delivery = await this.findOne(id);
    const updated = await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status,
        notes: notes ?? delivery.notes,
        deliveredAt: status === DeliveryStatus.LIVREE ? new Date() : delivery.deliveredAt,
      },
      include: { client: true, order: true, lines: { include: { product: true } } },
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.CHEF_EXPLOITATION, UserRole.COMMERCIAL],
      {
        title: 'Statut livraison',
        message: `${updated.deliveryNumber} — ${updated.client.name} : ${status}`,
        type: status === DeliveryStatus.LIVREE ? NotificationType.SUCCESS : NotificationType.INFO,
        category: NotificationCategory.LIVRAISON,
        link: '/deliveries',
      },
    );
    return updated;
  }

  async remove(id: string) {
    const delivery = await this.findOne(id);
    if (delivery.status === DeliveryStatus.LIVREE) {
      throw new BadRequestException('Impossible de supprimer une livraison déjà effectuée');
    }
    return this.prisma.delivery.delete({ where: { id } });
  }
}
