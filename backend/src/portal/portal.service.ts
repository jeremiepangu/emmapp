import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationCategory, NotificationType, OrderStatus, PaymentMethod, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.module';
import { ACCOUNT_SELECT } from './portal-auth.service';

/** 100 points = 1 000 CDF de portefeuille. */
const POINTS_TO_WALLET = 10;
const AVG_STOP_MINUTES = 12;

@Injectable()
export class PortalService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private pricing: PricingService,
  ) {}

  async me(clientId: string, accountId: string) {
    const account = await this.prisma.portalAccount.findUnique({
      where: { id: accountId },
      select: ACCOUNT_SELECT,
    });
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!account || !client) throw new NotFoundException();
    const openOrders = await this.prisma.order.count({
      where: { clientId, status: { notIn: [OrderStatus.LIVREE, OrderStatus.ANNULEE] } },
    });
    const orders = await this.prisma.order.findMany({ where: { clientId }, select: { totalAmount: true } });
    const payments = await this.prisma.payment.findMany({ where: { clientId }, select: { amount: true } });
    const ordered = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    return {
      account,
      client: {
        ...client,
        creditLimit: Number(client.creditLimit),
        creditBalance: Number(client.creditBalance),
        walletBalance: Number(client.walletBalance),
      },
      consigneBalance: client.consigneBalance,
      consigneLimit: client.consigneLimit,
      openOrders,
      outstandingAmount: Math.max(0, ordered - paid),
    };
  }

  async catalog(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException();
    const rules = await this.pricing.findActive();
    const ctx = this.pricing.ctxFromClient(client);
    const products = await this.prisma.product.findMany({ where: { isActive: true } });
    return products.map((p) => {
      const priced = this.pricing.apply(rules, ctx, p, 1);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        format: p.format,
        isReusable: p.isReusable,
        basePrice: Number(p.unitPrice),
        segmentPrice: Number(priced.unitPrice),
        discountPct: priced.discountPct,
        tiers: this.pricing.tiersFor(rules, ctx, p.id),
      };
    });
  }

  orders(clientId: string) {
    return this.prisma.order.findMany({
      where: { clientId },
      include: { lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrder(clientId: string, body: { lines: Array<{ productId: string; quantity: number }>; notes?: string }) {
    const lines = (body.lines ?? []).filter((line) => line.quantity > 0);
    if (!lines.length) throw new BadRequestException('Ajoutez au moins un produit');
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException();
    const count = await this.prisma.order.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `CMD-${date}-${String(count + 1).padStart(4, '0')}`;
    let total = new Prisma.Decimal(0);
    const linesData: Array<{ productId: string; quantity: number; unitPrice: Prisma.Decimal; discount: Prisma.Decimal }> = [];
    for (const line of lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new NotFoundException(`Produit ${line.productId} introuvable`);
      const priced = await this.pricing.priceLine(this.pricing.ctxFromClient(client), product, line.quantity);
      total = total.add(priced.unitPrice.mul(line.quantity));
      linesData.push({
        productId: product.id,
        quantity: line.quantity,
        unitPrice: priced.unitPrice,
        discount: priced.discount,
      });
    }
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        clientId,
        notes: body.notes,
        totalAmount: total,
        status: OrderStatus.VALIDEE,
        lines: { create: linesData },
      },
      include: { lines: { include: { product: true } }, client: true },
    });
    await this.notifications.notifyRoles(
      [UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION, UserRole.ADMIN],
      {
        title: 'Commande portail',
        message: `${client.name} a passé ${order.orderNumber} (${Math.round(Number(total))} CDF).`,
        type: NotificationType.INFO,
        category: NotificationCategory.PORTAIL,
        link: '/orders',
      },
    );
    return order;
  }

  deliveries(clientId: string) {
    return this.prisma.delivery.findMany({
      where: { clientId },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async tracking(clientId: string, id: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, clientId },
      include: {
        tour: { include: { driver: { select: { firstName: true, lastName: true } }, vehicle: true, deliveries: true } },
        order: true,
      },
    });
    if (!delivery) throw new NotFoundException('Livraison introuvable');
    const remaining = delivery.tour.deliveries.filter((d) => d.status === 'EN_ATTENTE').length;
    const last = delivery.tour.deliveries
      .filter((d) => d.latitude != null)
      .sort((a, b) => (b.deliveredAt?.getTime() ?? 0) - (a.deliveredAt?.getTime() ?? 0))[0];
    return {
      deliveryId: delivery.id,
      deliveryNumber: delivery.deliveryNumber,
      status: delivery.status,
      tourNumber: delivery.tour.tourNumber,
      driverName: `${delivery.tour.driver.firstName} ${delivery.tour.driver.lastName}`,
      vehiclePlate: delivery.tour.vehicle.plate,
      latitude: delivery.latitude ?? last?.latitude,
      longitude: delivery.longitude ?? last?.longitude,
      etaMinutes: remaining * AVG_STOP_MINUTES,
      stopsRemaining: remaining,
      updatedAt: new Date().toISOString(),
      timeline: [
        { label: 'Commande validée', at: delivery.order.createdAt.toISOString(), done: true },
        { label: 'Chargement validé', at: delivery.tour.startedAt?.toISOString(), done: Boolean(delivery.tour.startedAt) },
        { label: 'Tournée démarrée', at: delivery.tour.startedAt?.toISOString(), done: Boolean(delivery.tour.startedAt) },
        { label: 'En route', at: delivery.deliveredAt?.toISOString(), done: delivery.status !== 'EN_ATTENTE' },
        { label: 'Livrée', at: delivery.deliveredAt?.toISOString(), done: delivery.status === 'LIVREE' },
      ],
    };
  }

  async invoices(clientId: string) {
    const orders = await this.prisma.order.findMany({
      where: { clientId },
      include: { deliveries: { include: { payments: true } }, client: { include: { payments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const payments = await this.prisma.payment.findMany({ where: { clientId } });
    return orders.map((o) => {
      const related = payments.filter((p) => p.deliveryId && o.deliveries.some((d) => d.id === p.deliveryId));
      const paidAmount = related.reduce((s, p) => s + Number(p.amount), 0);
      const totalAmount = Number(o.totalAmount);
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString(),
        totalAmount,
        paidAmount,
        balance: Math.max(0, totalAmount - paidAmount),
        status: o.status,
      };
    });
  }

  async pay(clientId: string, body: { orderId?: string; amount: number; method: PaymentMethod; reference?: string }) {
    const allowed: PaymentMethod[] = ['MOBILE_MONEY', 'MPESA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'WAVE'];
    if (!allowed.includes(body.method)) {
      throw new BadRequestException('Seule la monnaie électronique est acceptée sur le portail');
    }
    let deliveryId: string | undefined;
    if (body.orderId) {
      const delivery = await this.prisma.delivery.findFirst({ where: { orderId: body.orderId, clientId } });
      deliveryId = delivery?.id;
    }
    const count = await this.prisma.payment.count();
    const paymentNumber = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
    const collector = await this.prisma.user.findFirst({ where: { role: UserRole.CAISSIER, isActive: true } })
      ?? await this.prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    if (!collector) throw new BadRequestException('Aucun caissier pour rattacher l\'encaissement');
    const payment = await this.prisma.payment.create({
      data: {
        paymentNumber,
        clientId,
        deliveryId,
        amount: body.amount,
        method: body.method,
        reference: body.reference || `PORTAL-${Date.now()}`,
        collectedBy: collector.id,
      },
    });
    await this.notifications.notifyRoles(
      [UserRole.CAISSIER, UserRole.COMPTABLE, UserRole.ADMIN],
      {
        title: 'Paiement portail',
        message: `${body.amount} CDF via ${body.method}`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.PAIEMENT,
        link: '/payments',
      },
    );
    return payment;
  }

  async loyalty(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException();
    const tiers = [
      { name: 'BRONZE', min: 0, next: 'ARGENT', threshold: 100, benefits: ['Cumul de points à chaque livraison'] },
      { name: 'ARGENT', min: 100, next: 'OR', threshold: 300, benefits: ['Remise boutique', 'Priorité de tournée'] },
      { name: 'OR', min: 300, next: undefined, threshold: undefined, benefits: ['Remise entreprise', 'Échange de points', 'Volume bonus'] },
    ];
    const current = tiers.find((t) => t.name === client.loyaltyTier) ?? tiers[0];
    const pointsToNextTier = current.threshold ? Math.max(0, current.threshold - client.loyaltyPoints) : undefined;
    return {
      points: client.loyaltyPoints,
      tier: client.loyaltyTier,
      walletBalance: Number(client.walletBalance),
      nextTier: current.next,
      pointsToNextTier,
      benefits: current.benefits,
      history: [{ label: 'Solde actuel', points: client.loyaltyPoints, at: new Date().toISOString() }],
    };
  }

  async redeem(clientId: string, points: number) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException();
    if (points <= 0 || client.loyaltyPoints < points) throw new BadRequestException('Solde de points insuffisant');
    const credit = points * POINTS_TO_WALLET;
    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        loyaltyPoints: { decrement: points },
        walletBalance: { increment: credit },
      },
    });
    return this.loyalty(clientId);
  }

  consignes(clientId: string) {
    return this.prisma.consigneMovement.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => rows.map((r) => ({
      id: r.id,
      type: r.qtyIn > 0 ? 'RETOUR' : 'SORTIE',
      quantity: r.qtyIn || r.qtyOut,
      productName: r.productFormat,
      createdAt: r.createdAt.toISOString(),
    })));
  }

  listAccounts() {
    return this.prisma.portalAccount.findMany({
      select: ACCOUNT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAccount(data: { email: string; password: string; fullName: string; clientId: string }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.portalAccount.create({
      data: {
        email: data.email.trim().toLowerCase(),
        passwordHash,
        fullName: data.fullName,
        clientId: data.clientId,
      },
      select: ACCOUNT_SELECT,
    });
  }

  async updateAccount(id: string, data: { isActive?: boolean; fullName?: string; password?: string }) {
    const patch: Prisma.PortalAccountUpdateInput = {};
    if (data.isActive != null) patch.isActive = data.isActive;
    if (data.fullName) patch.fullName = data.fullName;
    if (data.password) patch.passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.portalAccount.update({ where: { id }, data: patch, select: ACCOUNT_SELECT });
  }

  async deleteAccount(id: string) {
    await this.prisma.portalAccount.delete({ where: { id } });
  }
}
