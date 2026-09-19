import { Injectable } from '@nestjs/common';
import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentAllocationSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { ClientCreditService } from './client-credit.service';

/** Tolerance d'arrondi au centime pour considerer une commande soldee. */
export const EPSILON = new Prisma.Decimal('0.01');

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Repartit les versements sur les commandes du client et tient a jour
 * l'avance sur compte, c'est-a-dire le trop-percu pas encore impute.
 */
@Injectable()
export class PaymentAllocationService {
  constructor(
    private prisma: PrismaService,
    private credit: ClientCreditService,
  ) {}

  /** Reste a payer d'une commande, imputations deja enregistrees deduites. */
  async dueOf(db: Db, orderId: string) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { totalAmount: true, status: true },
    });
    if (!order || order.status === OrderStatus.ANNULEE) return new Prisma.Decimal(0);
    const sum = await db.paymentAllocation.aggregate({
      where: { orderId },
      _sum: { amount: true },
    });
    const due = new Prisma.Decimal(order.totalAmount).sub(sum._sum.amount ?? 0);
    return due.gt(0) ? due : new Prisma.Decimal(0);
  }

  /**
   * Impute un versement : d'abord sur la commande visee, puis sur les autres
   * commandes impayees du client, de la plus ancienne a la plus recente. Ce qui
   * reste au bout de la chaine est porte en avance sur compte.
   */
  async allocatePayment(db: Db, paymentId: string) {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;

    const touched = await this.clearAllocations(db, { paymentId });

    // Une avance reste au credit du client : la regle tient ici, et non chez
    // les appelants, pour qu'aucun flux de vente ne puisse la contourner.
    if (payment.isAdvance) {
      for (const orderId of touched) await this.refreshOrder(db, orderId);
      if (payment.clientId) await this.refreshClient(db, payment.clientId);
      return new Prisma.Decimal(payment.amount);
    }

    let remaining = new Prisma.Decimal(payment.amount);
    const targets = await this.targetOrders(db, payment.clientId, payment.orderId);

    for (const orderId of targets) {
      if (remaining.lte(EPSILON)) break;
      const due = await this.dueOf(db, orderId);
      if (due.lte(0)) continue;
      const amount = Prisma.Decimal.min(remaining, due);
      await db.paymentAllocation.create({
        data: {
          paymentId,
          orderId,
          amount,
          source: PaymentAllocationSource.PAIEMENT,
        },
      });
      remaining = remaining.sub(amount);
      touched.add(orderId);
    }

    for (const orderId of touched) await this.refreshOrder(db, orderId);
    if (payment.clientId) await this.refreshClient(db, payment.clientId);
    return remaining;
  }

  /**
   * Consomme l'avance disponible d'un client sur une commande fraichement
   * creee, pour qu'un trop-percu anterieur serve sans intervention manuelle.
   */
  async consumeAdvance(db: Db, orderId: string, clientId: string) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { advanceBalance: true },
    });
    const available = new Prisma.Decimal(client?.advanceBalance ?? 0);
    if (available.lte(0)) return new Prisma.Decimal(0);

    const due = await this.dueOf(db, orderId);
    if (due.lte(0)) return new Prisma.Decimal(0);

    const amount = Prisma.Decimal.min(available, due);
    await db.paymentAllocation.create({
      data: { orderId, amount, source: PaymentAllocationSource.AVANCE },
    });
    await this.refreshOrder(db, orderId);
    await this.refreshClient(db, clientId);
    return amount;
  }

  /** Supprime des imputations et renvoie les commandes a recalculer. */
  async clearAllocations(db: Db, where: Prisma.PaymentAllocationWhereInput) {
    const existing = await db.paymentAllocation.findMany({
      where,
      select: { id: true, orderId: true },
    });
    if (existing.length === 0) return new Set<string>();
    await db.paymentAllocation.deleteMany({
      where: { id: { in: existing.map((a) => a.id) } },
    });
    return new Set(existing.map((a) => a.orderId));
  }

  /** Recalcule le cumul verse et le statut de reglement d'une commande. */
  async refreshOrder(db: Db, orderId: string) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { totalAmount: true },
    });
    if (!order) return;
    const sum = await db.paymentAllocation.aggregate({
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
    await db.order.update({
      where: { id: orderId },
      data: { paidAmount, paymentStatus: status },
    });
  }

  /** Met a jour l'avance puis la dette en argent du client. */
  async refreshClient(db: Db, clientId: string) {
    await this.refreshAdvance(db, clientId);
    await this.credit.refresh(clientId, db as Prisma.TransactionClient);
  }

  /**
   * L'avance se deduit des flux plutot que de s'incrementer : encaissements du
   * client, moins ce qui a ete impute depuis ses versements, moins ce qui a
   * deja ete consomme sur ses commandes.
   */
  async refreshAdvance(db: Db, clientId: string) {
    const collected = await db.payment.aggregate({
      where: { clientId },
      _sum: { amount: true },
    });
    const fromPayments = await db.paymentAllocation.aggregate({
      where: { source: PaymentAllocationSource.PAIEMENT, payment: { clientId } },
      _sum: { amount: true },
    });
    const fromAdvance = await db.paymentAllocation.aggregate({
      where: { source: PaymentAllocationSource.AVANCE, order: { clientId } },
      _sum: { amount: true },
    });

    let balance = new Prisma.Decimal(collected._sum.amount ?? 0)
      .sub(fromPayments._sum.amount ?? 0)
      .sub(fromAdvance._sum.amount ?? 0);

    // Une avance deja consommee perd sa contrepartie si le versement d'origine
    // est supprime ou reduit. On defait alors les imputations d'avance les plus
    // recentes : sans cela les commandes resteraient soldees avec de l'argent
    // qui n'existe plus, et l'ecretage a zero masquerait le decouvert.
    if (balance.lt(0)) {
      const consumed = await db.paymentAllocation.findMany({
        where: { source: PaymentAllocationSource.AVANCE, order: { clientId } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderId: true, amount: true },
      });
      const touched = new Set<string>();
      for (const allocation of consumed) {
        if (balance.gte(0)) break;
        const taken = Prisma.Decimal.min(balance.neg(), allocation.amount);
        if (taken.gte(allocation.amount)) {
          await db.paymentAllocation.delete({ where: { id: allocation.id } });
        } else {
          await db.paymentAllocation.update({
            where: { id: allocation.id },
            data: { amount: new Prisma.Decimal(allocation.amount).sub(taken) },
          });
        }
        balance = balance.add(taken);
        touched.add(allocation.orderId);
      }
      for (const orderId of touched) await this.refreshOrder(db, orderId);
    }

    const advanceBalance = balance.gt(0) ? balance : new Prisma.Decimal(0);

    await db.client.update({ where: { id: clientId }, data: { advanceBalance } });
    return advanceBalance;
  }

  /**
   * Ordre d'imputation : la commande visee d'abord, puis les autres commandes
   * non soldees du client, les plus anciennes en premier.
   */
  private async targetOrders(db: Db, clientId?: string | null, orderId?: string | null) {
    const ids: string[] = [];
    if (orderId) ids.push(orderId);
    if (!clientId) return ids;

    const others = await db.order.findMany({
      where: {
        clientId,
        id: orderId ? { not: orderId } : undefined,
        status: { not: OrderStatus.ANNULEE },
        paymentStatus: { in: [OrderPaymentStatus.IMPAYEE, OrderPaymentStatus.PARTIELLE] },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return [...ids, ...others.map((o) => o.id)];
  }
}
