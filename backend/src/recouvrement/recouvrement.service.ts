import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DiscrepancyStatus,
  NotificationCategory,
  NotificationType,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  ProductFormat,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

export type RecouvrementFilter = 'TOUS' | 'ARGENT' | 'VIDANGE' | 'CREDITEUR';

export interface RecouvrementRow {
  clientId: string;
  code: string;
  name: string;
  segment: string;
  phone: string | null;
  /** Reste a payer cumule sur les commandes actives. */
  moneyDue: number;
  /** Trop-percu disponible, imputable sur les prochaines commandes. */
  advance: number;
  creditLimit: number;
  /** Contenants dus par le client. */
  emptiesDue: number;
  /** Contenants rapportes en trop. */
  emptiesCredit: number;
  emptiesValue: number;
  consigneLimit: number;
  formats: Array<{ productFormat: ProductFormat; quantity: number; amount: number }>;
  unpaidOrders: number;
  /** Anciennete en jours de la plus vieille commande non soldee. */
  oldestDebtDays: number | null;
  lastPaymentAt: Date | null;
  lastReturnAt: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class RecouvrementService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Etat de recouvrement de tous les clients concernes : dette en argent,
   * avance, dette et avoir en contenants, avec l'anciennete de la creance.
   */
  async overview(params?: { filter?: RecouvrementFilter; minAgeDays?: number; search?: string }) {
    const filter = params?.filter ?? 'TOUS';

    const clients = await this.prisma.client.findMany({
      where: params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        code: true,
        name: true,
        segment: true,
        phone: true,
        creditLimit: true,
        advanceBalance: true,
        consigneLimit: true,
        consigneBalances: true,
        orders: {
          where: {
            status: { not: OrderStatus.ANNULEE },
            paymentStatus: { in: [OrderPaymentStatus.IMPAYEE, OrderPaymentStatus.PARTIELLE] },
          },
          select: { createdAt: true, totalAmount: true, paidAmount: true },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        consignes: {
          where: { qtyIn: { gt: 0 } },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const now = Date.now();
    const rows: RecouvrementRow[] = clients.map((c) => {
      const moneyDue = c.orders.reduce((sum, o) => {
        const remaining = new Prisma.Decimal(o.totalAmount).sub(o.paidAmount);
        return remaining.gt(0) ? sum.add(remaining) : sum;
      }, new Prisma.Decimal(0));

      const emptiesNet = c.consigneBalances.reduce((sum, b) => sum + b.quantity, 0);
      const oldest = c.orders[0]?.createdAt;

      return {
        clientId: c.id,
        code: c.code,
        name: c.name,
        segment: c.segment,
        phone: c.phone,
        moneyDue: Number(moneyDue),
        advance: Number(c.advanceBalance),
        creditLimit: Number(c.creditLimit),
        emptiesDue: Math.max(0, emptiesNet),
        emptiesCredit: Math.max(0, -emptiesNet),
        emptiesValue: c.consigneBalances.reduce((sum, b) => sum + Number(b.amount), 0),
        consigneLimit: c.consigneLimit,
        formats: c.consigneBalances
          .filter((b) => b.quantity !== 0)
          .map((b) => ({
            productFormat: b.productFormat,
            quantity: b.quantity,
            amount: Number(b.amount),
          })),
        unpaidOrders: c.orders.length,
        oldestDebtDays: oldest ? Math.floor((now - oldest.getTime()) / DAY) : null,
        lastPaymentAt: c.payments[0]?.createdAt ?? null,
        lastReturnAt: c.consignes[0]?.createdAt ?? null,
      };
    });

    const minAge = params?.minAgeDays ?? 0;
    return rows
      .filter((r) => {
        if (minAge > 0 && (r.oldestDebtDays ?? -1) < minAge) return false;
        if (filter === 'ARGENT') return r.moneyDue > 0;
        if (filter === 'VIDANGE') return r.emptiesDue > 0;
        if (filter === 'CREDITEUR') return r.advance > 0 || r.emptiesCredit > 0;
        return r.moneyDue > 0 || r.emptiesDue > 0 || r.advance > 0 || r.emptiesCredit > 0;
      })
      .sort((a, b) => b.moneyDue - a.moneyDue || b.emptiesDue - a.emptiesDue);
  }

  /** Situation detaillee d'un client, telle qu'affichee dans les ecrans de vente. */
  async situation(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        code: true,
        name: true,
        segment: true,
        phone: true,
        creditLimit: true,
        creditBalance: true,
        advanceBalance: true,
        consigneLimit: true,
        consigneBalances: { orderBy: { productFormat: 'asc' } },
      },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    const [orders, payments, movements, discrepancies] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          clientId,
          status: { not: OrderStatus.ANNULEE },
          paymentStatus: { in: [OrderPaymentStatus.IMPAYEE, OrderPaymentStatus.PARTIELLE] },
        },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          totalAmount: true,
          paidAmount: true,
          paymentStatus: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { clientId },
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          method: true,
          isAdvance: true,
          createdAt: true,
          order: { select: { orderNumber: true, paymentStatus: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.consigneMovement.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.discrepancy.findMany({
        where: { clientId, status: { not: DiscrepancyStatus.REGULARISE } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const emptiesNet = client.consigneBalances.reduce((sum, b) => sum + b.quantity, 0);

    return {
      client: {
        id: client.id,
        code: client.code,
        name: client.name,
        segment: client.segment,
        phone: client.phone,
        creditLimit: Number(client.creditLimit),
        consigneLimit: client.consigneLimit,
      },
      money: {
        due: Number(client.creditBalance),
        advance: Number(client.advanceBalance),
        limit: Number(client.creditLimit),
        unpaidOrders: orders.length,
      },
      empties: {
        due: Math.max(0, emptiesNet),
        credit: Math.max(0, -emptiesNet),
        value: client.consigneBalances.reduce((sum, b) => sum + Number(b.amount), 0),
        limit: client.consigneLimit,
        formats: client.consigneBalances
          .filter((b) => b.quantity !== 0)
          .map((b) => ({
            productFormat: b.productFormat,
            quantity: b.quantity,
            amount: Number(b.amount),
          })),
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        totalAmount: Number(o.totalAmount),
        paidAmount: Number(o.paidAmount),
        remaining: Number(new Prisma.Decimal(o.totalAmount).sub(o.paidAmount)),
        paymentStatus: o.paymentStatus,
        ageDays: Math.floor((Date.now() - o.createdAt.getTime()) / DAY),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amount: Number(p.amount),
        method: p.method,
        isAdvance: p.isAdvance,
        createdAt: p.createdAt,
        orderNumber: p.order?.orderNumber ?? null,
        orderPaymentStatus: p.order?.paymentStatus ?? null,
      })),
      movements: movements.map((m) => ({
        id: m.id,
        productFormat: m.productFormat,
        qtyIn: m.qtyIn,
        qtyOut: m.qtyOut,
        balanceAfter: m.balanceAfter,
        source: m.source,
        createdAt: m.createdAt,
      })),
      discrepancies,
    };
  }

  /** Relance commerciale : trace la demande aupres des equipes concernees. */
  async remind(clientId: string, notes?: string) {
    const situation = await this.situation(clientId);
    const details = [
      situation.money.due > 0 ? `${situation.money.due.toFixed(2)} a encaisser` : null,
      situation.empties.due > 0 ? `${situation.empties.due} contenant(s) a recuperer` : null,
    ]
      .filter(Boolean)
      .join(' — ');

    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.COMPTABLE],
      {
        title: 'Relance de recouvrement',
        message: `${situation.client.name} : ${details || 'situation a verifier'}${notes ? ` (${notes})` : ''}`,
        type: NotificationType.WARNING,
        category: NotificationCategory.PAIEMENT,
        link: '/recouvrement',
      },
    );
    return situation;
  }
}
