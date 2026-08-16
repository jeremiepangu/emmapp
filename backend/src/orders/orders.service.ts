import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { PricingService } from '../pricing/pricing.service';
import { CreateOrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
  ) {}

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `CMD-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  findAll(params?: { status?: OrderStatus; clientId?: string; tourId?: string }) {
    const where: Prisma.OrderWhereInput = {};
    if (params?.status) where.status = params.status;
    if (params?.clientId) where.clientId = params.clientId;
    if (params?.tourId) where.tourId = params.tourId;

    return this.prisma.order.findMany({
      where,
      include: {
        client: true,
        lines: { include: { product: true } },
        tour: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        lines: { include: { product: true } },
        tour: true,
        deliveries: true,
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }

  async create(dto: CreateOrderDto, actor?: { id: string; role: string }) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    let driverId = dto.driverId || null;
    if (dto.tourId) {
      const tour = await this.prisma.tour.findUnique({ where: { id: dto.tourId } });
      if (tour) driverId = tour.driverId;
    } else if (!driverId && actor && (actor.role === 'LIVREUR' || actor.role === 'CHARGE_LIVRAISON')) {
      driverId = actor.id;
    }
    const ctx = this.pricing.ctxFromClient(client, driverId);

    let totalAmount = new Prisma.Decimal(0);
    const linesData: Array<{
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
    }> = [];

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({
        where: { id: line.productId },
      });
      if (!product) {
        throw new NotFoundException(`Produit ${line.productId} introuvable`);
      }
      const priced = await this.pricing.priceLine(ctx, product, line.quantity);
      const extra = new Prisma.Decimal(line.discount ?? 0);
      const discount = priced.discount.add(extra);
      totalAmount = totalAmount.add(priced.unitPrice.mul(line.quantity).sub(extra));
      linesData.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: priced.unitPrice,
        discount,
      });
    }

    return this.prisma.order.create({
      data: {
        orderNumber: await this.generateOrderNumber(),
        clientId: dto.clientId,
        tourId: dto.tourId,
        notes: dto.notes,
        totalAmount,
        status: OrderStatus.VALIDEE,
        lines: { create: linesData },
      },
      include: {
        client: true,
        lines: { include: { product: true } },
      },
    });
  }

  async validate(id: string) {
    const order = await this.findOne(id);
    if (order.status !== OrderStatus.BROUILLON) {
      throw new BadRequestException('Commande déjà validée');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.VALIDEE },
    });
  }

  async cancel(id: string) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.LIVREE || order.status === OrderStatus.ANNULEE) {
      throw new BadRequestException('Impossible d\'annuler cette commande');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.ANNULEE },
    });
  }

  async updateNotes(id: string, notes: string) {
    await this.findOne(id);
    return this.prisma.order.update({
      where: { id },
      data: { notes },
      include: { client: true, lines: { include: { product: true } } },
    });
  }

  async remove(id: string) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.LIVREE) {
      throw new BadRequestException('Impossible de supprimer une commande livrée');
    }
    return this.prisma.order.delete({ where: { id } });
  }
}
