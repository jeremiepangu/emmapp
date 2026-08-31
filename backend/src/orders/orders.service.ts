import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationCategory, NotificationType, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { PricingService } from '../pricing/pricing.service';
import { ConsignesService } from '../consignes/consignes.service';
import { ClientCreditService } from '../payments/client-credit.service';
import { PaymentAllocationService } from '../payments/payment-allocation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private consignes: ConsignesService,
    private credit: ClientCreditService,
    private allocations: PaymentAllocationService,
    private notifications: NotificationsService,
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

    let goodsAmount = new Prisma.Decimal(0);
    let consigneTotal = new Prisma.Decimal(0);
    let consigneQuantityTotal = 0;
    const linesData: Array<{
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      bonusQuantity: number;
      bonus: Prisma.Decimal;
      emptiesReturned: number;
      consigneQuantity: number;
      consigneAmount: Prisma.Decimal;
    }> = [];

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({
        where: { id: line.productId },
      });
      if (!product) {
        throw new NotFoundException(`Produit ${line.productId} introuvable`);
      }
      const priced = await this.pricing.priceLine(ctx, product, line.quantity);
      const extraQty = Math.max(0, Math.floor(line.bonusQuantity ?? 0));
      const bonusQuantity = priced.bonusQuantity + extraQty;
      const bonus = priced.catalogPrice.mul(bonusQuantity).toDecimalPlaces(2);
      goodsAmount = goodsAmount.add(priced.unitPrice.mul(line.quantity));

      // Chaque contenant sorti sans vide rendu en echange est consigne.
      const containersOut = product.isReusable ? line.quantity + bonusQuantity : 0;
      // Le client peut rapporter plus de vides qu'il n'en emporte : le surplus
      // apure sa dette de consigne et peut la rendre creditrice.
      const emptiesReturned = product.isReusable
        ? Math.max(0, Math.floor(line.emptiesReturned ?? 0))
        : 0;
      const consigneQuantity = Math.max(0, containersOut - emptiesReturned);
      const consigneAmount = new Prisma.Decimal(product.consigneAmount)
        .mul(consigneQuantity)
        .toDecimalPlaces(2);
      consigneTotal = consigneTotal.add(consigneAmount);
      consigneQuantityTotal += consigneQuantity;

      linesData.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: priced.unitPrice,
        bonusQuantity,
        bonus,
        emptiesReturned,
        consigneQuantity,
        consigneAmount,
      });
    }

    await this.consignes.assertWithinLimit(dto.clientId, consigneQuantityTotal);
    const totalAmount = goodsAmount.add(consigneTotal);

    // La commande et la consommation de son avance forment un tout : les
    // separer laisserait une commande sans son imputation en cas d'echec.
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: await this.generateOrderNumber(),
          clientId: dto.clientId,
          tourId: dto.tourId,
          notes: dto.notes,
          totalAmount,
          consigneAmount: consigneTotal,
          status: OrderStatus.VALIDEE,
          lines: { create: linesData },
        },
        include: {
          client: true,
          lines: { include: { product: true } },
        },
      });
      // Une avance laissee par un versement anterieur solde d'office la commande.
      await this.allocations.consumeAdvance(tx, order.id, dto.clientId);
      return order;
    });
    await this.credit.refresh(dto.clientId);
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION],
      {
        title: 'Nouvelle commande',
        message: `${created.orderNumber} — ${created.client.name}`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.COMMANDE,
        link: '/orders',
      },
    );
    return created;
  }

  async validate(id: string) {
    const order = await this.findOne(id);
    if (order.status !== OrderStatus.BROUILLON) {
      throw new BadRequestException('Commande déjà validée');
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.VALIDEE },
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION],
      {
        title: 'Commande validee',
        message: `${order.orderNumber} — ${order.client.name}`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.COMMANDE,
        link: '/orders',
      },
    );
    return updated;
  }

  async cancel(id: string) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.LIVREE || order.status === OrderStatus.ANNULEE) {
      throw new BadRequestException('Impossible d\'annuler cette commande');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.ANNULEE },
      });
      // Ce qui avait ete impute sur cette commande redevient disponible.
      await this.allocations.clearAllocations(tx, { orderId: id });
      await this.allocations.refreshOrder(tx, id);
      await this.allocations.refreshClient(tx, order.clientId);
      return cancelled;
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION],
      {
        title: 'Commande annulee',
        message: `${order.orderNumber} — ${order.client.name}`,
        type: NotificationType.WARNING,
        category: NotificationCategory.COMMANDE,
        link: '/orders',
      },
    );
    return updated;
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
