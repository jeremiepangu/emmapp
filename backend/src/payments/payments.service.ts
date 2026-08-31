import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { ClientCreditService } from './client-credit.service';
import { CreatePaymentDto } from './dto/payment.dto';

/** Tolerance d'arrondi au centime pour considerer une commande soldee. */
const EPSILON = new Prisma.Decimal('0.01');

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private finance: FinanceService,
    private credit: ClientCreditService,
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
      const remaining = new Prisma.Decimal(order.totalAmount).sub(order.paidAmount);
      if (amount.sub(remaining).gt(EPSILON)) {
        throw new BadRequestException(
          `Le versement depasse le reste a payer (${remaining.toFixed(2)})`,
        );
      }
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
      if (orderId) await this.refreshOrderPayment(tx, orderId);
      if (clientId) await this.refreshClientCredit(tx, clientId);
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
      if (existing.orderId) await this.refreshOrderPayment(tx, existing.orderId);
      if (existing.clientId) await this.refreshClientCredit(tx, existing.clientId);
      return payment;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Paiement introuvable');
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.payment.delete({ where: { id } });
      if (existing.orderId) await this.refreshOrderPayment(tx, existing.orderId);
      if (existing.clientId) await this.refreshClientCredit(tx, existing.clientId);
      return deleted;
    });
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

  /** Recalcule le cumul verse et le statut de reglement d'une commande. */
  private async refreshOrderPayment(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const sum = await tx.payment.aggregate({
      where: { orderId },
      _sum: { amount: true },
    });
    const paidAmount = new Prisma.Decimal(sum._sum.amount ?? 0);
    const total = new Prisma.Decimal(order.totalAmount);
    const status = paidAmount.lte(0)
      ? OrderPaymentStatus.IMPAYEE
      : total.sub(paidAmount).lte(EPSILON)
        ? OrderPaymentStatus.SOLDEE
        : OrderPaymentStatus.PARTIELLE;
    await tx.order.update({
      where: { id: orderId },
      data: { paidAmount, paymentStatus: status },
    });
  }

  private refreshClientCredit(tx: Prisma.TransactionClient, clientId: string) {
    return this.credit.refresh(clientId, tx);
  }
}
