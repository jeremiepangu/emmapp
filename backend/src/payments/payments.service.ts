import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  Prisma,
  SyncStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceService } from '../finance/finance.service';
import { PaymentAllocationService } from './payment-allocation.service';
import { CreatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private finance: FinanceService,
    private allocations: PaymentAllocationService,
  ) {}

  private async generatePaymentNumber(): Promise<string> {
    const count = await this.prisma.payment.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `PAY-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  findAll(params?: { deliveryId?: string; orderId?: string; clientId?: string }) {
    return this.prisma.payment.findMany({
      where: {
        deliveryId: params?.deliveryId,
        orderId: params?.orderId,
        clientId: params?.clientId,
      },
      include: {
        client: { select: { name: true } },
        collector: { select: { firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true, totalAmount: true, paidAmount: true } },
        allocations: {
          select: { orderId: true, amount: true, source: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Commandes non soldees, avec leur reste a payer. */
  async outstanding(clientId?: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        clientId,
        status: { not: OrderStatus.ANNULEE },
        paymentStatus: { in: [OrderPaymentStatus.IMPAYEE, OrderPaymentStatus.PARTIELLE] },
      },
      include: {
        client: { select: { id: true, code: true, name: true, creditLimit: true, creditBalance: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      client: o.client,
      totalAmount: Number(o.totalAmount),
      consigneAmount: Number(o.consigneAmount),
      paidAmount: Number(o.paidAmount),
      remaining: Number(new Prisma.Decimal(o.totalAmount).sub(o.paidAmount)),
      paymentStatus: o.paymentStatus,
    }));
  }

  async create(dto: CreatePaymentDto, collectedBy: string) {
    if (dto.localId) {
      const existing = await this.prisma.payment.findUnique({
        where: { localId: dto.localId },
      });
      if (existing) return existing;
    }

    const orderId = await this.resolveOrderId(dto);
    const amount = new Prisma.Decimal(dto.amount);

    if (orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Commande introuvable');
    }

    const clientId = dto.clientId ?? (orderId
      ? (await this.prisma.order.findUnique({ where: { id: orderId } }))?.clientId
      : undefined);

    const created = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentNumber: await this.generatePaymentNumber(),
          deliveryId: dto.deliveryId,
          orderId: orderId ?? undefined,
          clientId,
          amount,
          method: dto.method,
          reference: dto.reference,
          collectedBy,
          localId: dto.localId,
          syncStatus: SyncStatus.SYNCED,
        },
        include: {
          client: { select: { name: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });
      await this.allocations.allocatePayment(tx, payment.id);
      return payment;
    });

    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMPTABLE, UserRole.CAISSIER, UserRole.COMMERCIAL],
      {
        title: 'Paiement recu',
        message: `${created.paymentNumber} — ${created.client?.name ?? created.clientId} : ${created.amount} (${created.method})`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.PAIEMENT,
        link: '/payments',
      },
    );
    void this.finance
      .postFromPayment({
        paymentId: created.id,
        amount: Number(created.amount),
        method: created.method,
        reference: created.reference,
        label: `Encaissement ${created.paymentNumber}`,
        collectedBy,
      })
      .catch(() => undefined);
    return created;
  }

  async update(
    id: string,
    data: Partial<{ amount: number; method: PaymentMethod; reference: string }>,
  ) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Paiement introuvable');
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id },
        data,
        include: {
          client: { select: { name: true } },
          collector: { select: { firstName: true, lastName: true } },
        },
      });
      await this.allocations.allocatePayment(tx, payment.id);
      return payment;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Paiement introuvable');
    return this.prisma.$transaction(async (tx) => {
      const touched = await this.allocations.clearAllocations(tx, { paymentId: id });
      const deleted = await tx.payment.delete({ where: { id } });
      for (const orderId of touched) await this.allocations.refreshOrder(tx, orderId);
      if (existing.clientId) await this.allocations.refreshClient(tx, existing.clientId);
      return deleted;
    });
  }

  /**
   * Repartition previsionnelle d'un versement, pour que l'agent voie avant
   * validation ce qui solde des commandes et ce qui partira en avance.
   */
  async previewAllocation(params: { amount: number; orderId?: string; clientId?: string }) {
    const clientId = params.clientId ?? (params.orderId
      ? (await this.prisma.order.findUnique({ where: { id: params.orderId } }))?.clientId
      : undefined);

    const ids: string[] = [];
    if (params.orderId) ids.push(params.orderId);
    if (clientId) {
      const others = await this.prisma.order.findMany({
        where: {
          clientId,
          id: params.orderId ? { not: params.orderId } : undefined,
          status: { not: OrderStatus.ANNULEE },
          paymentStatus: { in: [OrderPaymentStatus.IMPAYEE, OrderPaymentStatus.PARTIELLE] },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      ids.push(...others.map((o) => o.id));
    }

    let remaining = new Prisma.Decimal(params.amount);
    const lines: Array<{ orderId: string; orderNumber: string; due: number; allocated: number }> = [];

    for (const orderId of ids) {
      if (remaining.lte(0)) break;
      const due = await this.allocations.dueOf(this.prisma, orderId);
      if (due.lte(0)) continue;
      const allocated = Prisma.Decimal.min(remaining, due);
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { orderNumber: true },
      });
      lines.push({
        orderId,
        orderNumber: order?.orderNumber ?? orderId,
        due: Number(due),
        allocated: Number(allocated),
      });
      remaining = remaining.sub(allocated);
    }

    return {
      amount: params.amount,
      lines,
      advance: Number(remaining.gt(0) ? remaining : 0),
    };
  }

  /**
   * Un versement encaisse a la livraison porte implicitement sur la commande
   * livree : on retablit le lien pour que le reste a payer reste juste.
   */
  private async resolveOrderId(dto: CreatePaymentDto) {
    if (dto.orderId) return dto.orderId;
    if (!dto.deliveryId) return null;
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: dto.deliveryId },
      select: { orderId: true },
    });
    return delivery?.orderId ?? null;
  }

}
