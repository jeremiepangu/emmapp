import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ConsigneMovementSource,
  NotificationCategory,
  NotificationType,
  Prisma,
  ProductFormat,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

export interface ConsigneMovementInput {
  clientId: string;
  productFormat: ProductFormat;
  /** Contenants vides rendus par le client. */
  qtyIn: number;
  /** Contenants sortis chez le client. */
  qtyOut: number;
  deliveryId?: string | null;
  orderId?: string | null;
  posSaleId?: string | null;
  source?: ConsigneMovementSource;
  /** Valeur unitaire de consigne. Deduite du catalogue si absente. */
  unitValue?: Prisma.Decimal | number | null;
  notes?: string;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class ConsignesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Valeur de consigne de reference pour un format, prise sur le produit
   * consigne le plus cher de ce format.
   */
  async unitValueFor(
    productFormat: ProductFormat,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const db = tx ?? this.prisma;
    const product = await db.product.findFirst({
      where: { format: productFormat, isReusable: true },
      orderBy: { consigneAmount: 'desc' },
      select: { consigneAmount: true },
    });
    return new Prisma.Decimal(product?.consigneAmount ?? 0);
  }

  async recordMovement(params: ConsigneMovementInput) {
    const db = params.tx ?? this.prisma;
    const client = await db.client.findUnique({ where: { id: params.clientId } });
    if (!client) return null;

    const qtyIn = Math.max(0, Math.floor(params.qtyIn ?? 0));
    const qtyOut = Math.max(0, Math.floor(params.qtyOut ?? 0));
    if (qtyIn === 0 && qtyOut === 0) return null;

    const unitValue = params.unitValue != null
      ? new Prisma.Decimal(params.unitValue)
      : await this.unitValueFor(params.productFormat, params.tx);

    const net = qtyOut - qtyIn;
    const balance = await this.applyToBalance(db, params.clientId, params.productFormat, net, unitValue);

    const movement = await db.consigneMovement.create({
      data: {
        clientId: params.clientId,
        deliveryId: params.deliveryId ?? undefined,
        orderId: params.orderId ?? undefined,
        posSaleId: params.posSaleId ?? undefined,
        productFormat: params.productFormat,
        source: params.source ?? ConsigneMovementSource.LIVRAISON,
        qtyIn,
        qtyOut,
        balanceAfter: balance.quantity,
        unitValue,
        amount: unitValue.mul(net),
        notes: params.notes,
      },
    });

    await this.alertOnLimit(db, params.clientId);
    return movement;
  }

  /**
   * Retour de vides hors livraison : le client rapporte des contenants,
   * sa dette diminue et la consigne correspondante lui est rendue.
   */
  async recordReturn(params: {
    clientId: string;
    productFormat: ProductFormat;
    quantity: number;
    notes?: string;
  }) {
    if (params.quantity <= 0) {
      throw new BadRequestException('La quantite rendue doit etre superieure a zero');
    }
    return this.recordMovement({
      clientId: params.clientId,
      productFormat: params.productFormat,
      qtyIn: params.quantity,
      qtyOut: 0,
      source: ConsigneMovementSource.RETOUR,
      notes: params.notes,
    });
  }

  /** Soldes par format d'un client, avec le total agrege. */
  async balancesFor(clientId: string) {
    const balances = await this.prisma.clientConsigneBalance.findMany({
      where: { clientId },
      orderBy: { productFormat: 'asc' },
    });
    return {
      formats: balances.map((b) => ({
        productFormat: b.productFormat,
        quantity: b.quantity,
        amount: Number(b.amount),
      })),
      totalQuantity: balances.reduce((sum, b) => sum + b.quantity, 0),
      totalAmount: balances.reduce((sum, b) => sum + Number(b.amount), 0),
    };
  }

  /** Clients ayant des contenants non restitues. */
  async debtors() {
    const balances = await this.prisma.clientConsigneBalance.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        client: {
          select: { id: true, code: true, name: true, segment: true, consigneLimit: true, phone: true },
        },
      },
      orderBy: { quantity: 'desc' },
    });

    const byClient = new Map<string, {
      client: (typeof balances)[number]['client'];
      totalQuantity: number;
      totalAmount: number;
      formats: Array<{ productFormat: ProductFormat; quantity: number; amount: number }>;
    }>();

    for (const row of balances) {
      const entry = byClient.get(row.clientId) ?? {
        client: row.client,
        totalQuantity: 0,
        totalAmount: 0,
        formats: [],
      };
      entry.totalQuantity += row.quantity;
      entry.totalAmount += Number(row.amount);
      entry.formats.push({
        productFormat: row.productFormat,
        quantity: row.quantity,
        amount: Number(row.amount),
      });
      byClient.set(row.clientId, entry);
    }

    return [...byClient.values()].sort((a, b) => b.totalQuantity - a.totalQuantity);
  }

  /**
   * Verifie qu'une sortie de contenants ne fait pas depasser le plafond du client.
   * Leve une erreur explicite plutot que de laisser passer la vente.
   */
  async assertWithinLimit(
    clientId: string,
    additionalQuantity: number,
    tx?: Prisma.TransactionClient,
  ) {
    if (additionalQuantity <= 0) return;
    const db = tx ?? this.prisma;
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client || client.consigneLimit <= 0) return;
    const next = client.consigneBalance + additionalQuantity;
    if (next > client.consigneLimit) {
      throw new BadRequestException(
        `Plafond de consignes depasse pour ${client.name} (${next}/${client.consigneLimit})`,
      );
    }
  }

  getClientHistory(clientId: string) {
    return this.prisma.consigneMovement.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listRecent() {
    return this.prisma.consigneMovement.findMany({
      include: { client: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async update(
    id: string,
    data: { productFormat?: ProductFormat; qtyIn?: number; qtyOut?: number; notes?: string },
  ) {
    const movement = await this.prisma.consigneMovement.findUnique({ where: { id } });
    if (!movement) throw new NotFoundException('Mouvement introuvable');

    const qtyIn = data.qtyIn ?? movement.qtyIn;
    const qtyOut = data.qtyOut ?? movement.qtyOut;
    const format = data.productFormat ?? movement.productFormat;
    const unitValue = format === movement.productFormat
      ? new Prisma.Decimal(movement.unitValue)
      : await this.unitValueFor(format);

    return this.prisma.$transaction(async (tx) => {
      // On annule l'effet de l'ancien mouvement avant d'appliquer le nouveau.
      await this.applyToBalance(
        tx,
        movement.clientId,
        movement.productFormat,
        -(movement.qtyOut - movement.qtyIn),
        new Prisma.Decimal(movement.unitValue),
      );
      const balance = await this.applyToBalance(
        tx,
        movement.clientId,
        format,
        qtyOut - qtyIn,
        unitValue,
      );

      return tx.consigneMovement.update({
        where: { id },
        data: {
          productFormat: format,
          qtyIn,
          qtyOut,
          notes: data.notes,
          unitValue,
          amount: unitValue.mul(qtyOut - qtyIn),
          balanceAfter: balance.quantity,
        },
        include: { client: { select: { name: true, code: true } } },
      });
    });
  }

  async remove(id: string) {
    const movement = await this.prisma.consigneMovement.findUnique({ where: { id } });
    if (!movement) throw new NotFoundException('Mouvement introuvable');
    return this.prisma.$transaction(async (tx) => {
      await this.applyToBalance(
        tx,
        movement.clientId,
        movement.productFormat,
        -(movement.qtyOut - movement.qtyIn),
        new Prisma.Decimal(movement.unitValue),
      );
      return tx.consigneMovement.delete({ where: { id } });
    });
  }

  /**
   * Applique une variation nette au solde du format puis reporte le total
   * agrege sur le client, qui reste la reference pour les plafonds.
   */
  private async applyToBalance(
    db: Prisma.TransactionClient | PrismaService,
    clientId: string,
    productFormat: ProductFormat,
    net: number,
    unitValue: Prisma.Decimal,
  ) {
    const current = await db.clientConsigneBalance.findUnique({
      where: { clientId_productFormat: { clientId, productFormat } },
    });
    const quantity = (current?.quantity ?? 0) + net;
    const amount = unitValue.mul(quantity);

    const balance = current
      ? await db.clientConsigneBalance.update({
          where: { id: current.id },
          data: { quantity, amount },
        })
      : await db.clientConsigneBalance.create({
          data: { clientId, productFormat, quantity, amount },
        });

    const totals = await db.clientConsigneBalance.aggregate({
      where: { clientId },
      _sum: { quantity: true },
    });
    await db.client.update({
      where: { id: clientId },
      data: { consigneBalance: totals._sum.quantity ?? 0 },
    });

    return balance;
  }

  private async alertOnLimit(db: Prisma.TransactionClient | PrismaService, clientId: string) {
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client || client.consigneLimit <= 0) return;
    if (client.consigneBalance < client.consigneLimit * 0.9) return;
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION],
      {
        title: 'Plafond consignes',
        message: `${client.name} : ${client.consigneBalance}/${client.consigneLimit}`,
        type: NotificationType.WARNING,
        category: NotificationCategory.CONSIGNE,
        link: '/consignes',
      },
    );
  }
}
