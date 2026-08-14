import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { CreateOrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

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

  async create(dto: CreateOrderDto) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    let totalAmount = new Prisma.Decimal(0);
    const linesData: Array<{
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discount: number;
    }> = [];

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({
        where: { id: line.productId },
      });
      if (!product) {
        throw new NotFoundException(`Produit ${line.productId} introuvable`);
      }
      const lineTotal = product.unitPrice
        .mul(line.quantity)
        .sub(line.discount ?? 0);
      totalAmount = totalAmount.add(lineTotal);
      linesData.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: product.unitPrice,
        discount: line.discount ?? 0,
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
}
