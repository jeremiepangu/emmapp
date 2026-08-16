import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryStatus, ProductFormat, SyncStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { ConsignesService } from '../consignes/consignes.service';
import { CreateDeliveryDto } from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(
    private prisma: PrismaService,
    private consignesService: ConsignesService,
  ) {}

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

    for (const line of dto.lines) {
      const product = order.lines.find((l) => l.productId === line.productId)?.product;
      if (product?.isReusable) {
        const netConsignes =
          line.qtyDelivered - (line.qtyReturned ?? 0);
        const newBalance = order.client.consigneBalance + netConsignes;
        if (newBalance > order.client.consigneLimit) {
          throw new BadRequestException(
            `Plafond de consignes dépassé pour ${order.client.name} (${newBalance}/${order.client.consigneLimit})`,
          );
        }
      }
    }

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
      if (product?.isReusable) {
        const format =
          product.format === ProductFormat.BONBONNE_19L
            ? ProductFormat.BONBONNE_19L
            : ProductFormat.BIDON_5L;
        await this.consignesService.recordMovement({
          clientId: order.clientId,
          deliveryId: delivery.id,
          productFormat: format,
          qtyIn: line.qtyReturned ?? 0,
          qtyOut: line.qtyDelivered,
        });
      }
    }

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
    return this.prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status,
        notes: notes ?? delivery.notes,
        deliveredAt: status === DeliveryStatus.LIVREE ? new Date() : delivery.deliveredAt,
      },
      include: { client: true, order: true, lines: { include: { product: true } } },
    });
  }

  async remove(id: string) {
    const delivery = await this.findOne(id);
    if (delivery.status === DeliveryStatus.LIVREE) {
      throw new BadRequestException('Impossible de supprimer une livraison déjà effectuée');
    }
    return this.prisma.delivery.delete({ where: { id } });
  }
}
