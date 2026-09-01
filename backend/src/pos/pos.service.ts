import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientSegment,
  ConsigneMovementSource,
  NotificationCategory,
  NotificationType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PosSaleStatus,
  Prisma,
  ProductFormat,
  StockLocationType,
  SyncStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { PricingService } from '../pricing/pricing.service';
import { ConsignesService } from '../consignes/consignes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceService } from '../finance/finance.service';
import { PaymentAllocationService } from '../payments/payment-allocation.service';
import { PaymentsService } from '../payments/payments.service';
import { PosAdvanceDto, PosAcompteDto, PosCheckoutDto, PosLineDto } from './dto/pos.dto';

const WALK_IN_CODE = 'CLI-POS';

const SALE_INCLUDE = {
  client: { select: { id: true, code: true, name: true, segment: true } },
  cashier: { select: { id: true, firstName: true, lastName: true } },
  order: { select: { id: true, orderNumber: true, status: true } },
  payment: { select: { id: true, paymentNumber: true, method: true, amount: true } },
  lines: { include: { product: { select: { id: true, code: true, name: true, format: true } } } },
} as const;

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private consignes: ConsignesService,
    private notifications: NotificationsService,
    private finance: FinanceService,
    private allocations: PaymentAllocationService,
    private payments: PaymentsService,
  ) {}

  async catalog() {
    const walkInClient = await this.ensureWalkInClient();
    const [products, clients] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          format: true,
          unitPrice: true,
          isReusable: true,
          imageUrl: true,
        },
      }),
      this.prisma.client.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        take: 300,
        select: { id: true, code: true, name: true, segment: true, zone: true, phone: true },
      }),
    ]);
    return {
      walkInClient,
      products: products.map((p) => ({ ...p, unitPrice: Number(p.unitPrice) })),
      clients,
      methods: Object.values(PaymentMethod),
    };
  }

  async list(params?: { from?: string; to?: string; cashierId?: string }) {
    const where: Prisma.PosSaleWhereInput = {};
    if (params?.cashierId) where.cashierId = params.cashierId;
    if (params?.from || params?.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }
    const rows = await this.prisma.posSale.findMany({
      where,
      include: SALE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const paid = rows.filter((r) => r.status === PosSaleStatus.PAYEE);
    const revenue = paid.reduce((s, r) => s + Number(r.totalAmount), 0);
    return {
      sales: rows,
      summary: {
        tickets: paid.length,
        cancelled: rows.length - paid.length,
        revenue,
        averageTicket: paid.length ? Math.round((revenue / paid.length) * 100) / 100 : 0,
      },
    };
  }

  async findOne(id: string) {
    const sale = await this.prisma.posSale.findUnique({ where: { id }, include: SALE_INCLUDE });
    if (!sale) throw new NotFoundException('Vente introuvable');
    return sale;
  }

  async quote(clientId: string | null | undefined, lines: PosLineDto[]) {
    if (!lines?.length) throw new BadRequestException('Le panier est vide');
    const client = await this.resolveClient(clientId);
    const ctx = this.pricing.ctxFromClient(client);
    const priced: Array<{
      productId: string;
      code: string;
      name: string;
      format: string;
      quantity: number;
      catalogPrice: number;
      unitPrice: number;
      bonusQuantity: number;
      bonus: number;
      isReusable: boolean;
      emptiesReturned: number;
      consigneQuantity: number;
      consigneAmount: number;
      lineTotal: number;
      ruleName: string | null;
    }> = [];
    let subtotal = new Prisma.Decimal(0);
    let bonus = new Prisma.Decimal(0);
    let goods = new Prisma.Decimal(0);
    let consigneTotal = new Prisma.Decimal(0);
    let bonusQuantity = 0;
    let consigneQuantityTotal = 0;
    for (const line of this.mergeLines(lines)) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product || !product.isActive) {
        throw new NotFoundException(`Produit ${line.productId} introuvable`);
      }
      const result = await this.pricing.priceLine(ctx, product, line.quantity);
      const lineTotal = result.unitPrice.mul(line.quantity);
      subtotal = subtotal.add(result.catalogPrice.mul(line.quantity));
      goods = goods.add(lineTotal);
      bonus = bonus.add(result.bonus);
      bonusQuantity += result.bonusQuantity;

      // Chaque contenant sorti sans vide rendu en echange est consigne.
      const containersOut = product.isReusable ? line.quantity + result.bonusQuantity : 0;
      // Le client peut rapporter plus de vides qu'il n'en emporte : le surplus
      // apure sa dette de consigne et peut la rendre creditrice.
      const emptiesReturned = product.isReusable
        ? Math.max(0, Math.floor(line.emptiesReturned))
        : 0;
      const consigneQuantity = Math.max(0, containersOut - emptiesReturned);
      const consigneAmount = new Prisma.Decimal(product.consigneAmount).mul(consigneQuantity);
      consigneTotal = consigneTotal.add(consigneAmount);
      consigneQuantityTotal += consigneQuantity;

      priced.push({
        productId: product.id,
        code: product.code,
        name: product.name,
        format: product.format,
        quantity: line.quantity,
        catalogPrice: Number(result.catalogPrice),
        unitPrice: Number(result.unitPrice),
        bonusQuantity: result.bonusQuantity,
        bonus: Number(result.bonus),
        isReusable: product.isReusable,
        emptiesReturned,
        consigneQuantity,
        consigneAmount: Number(consigneAmount),
        lineTotal: Number(lineTotal),
        ruleName: result.ruleName,
      });
    }
    const total = goods.add(consigneTotal).toDecimalPlaces(2);
    // L'avance deja versee vient en deduction de l'espece a encaisser.
    const advanceAvailable = new Prisma.Decimal(client.advanceBalance ?? 0);
    const advanceApplied = Prisma.Decimal.min(advanceAvailable, total);
    return {
      client: { id: client.id, code: client.code, name: client.name, segment: client.segment },
      lines: priced,
      subtotal: Number(subtotal),
      bonusQuantity,
      bonus: Number(bonus),
      goodsAmount: Number(goods.toDecimalPlaces(2)),
      consigneQuantity: consigneQuantityTotal,
      consigneAmount: Number(consigneTotal.toDecimalPlaces(2)),
      total: Number(total),
      advanceAvailable: Number(advanceAvailable),
      advanceApplied: Number(advanceApplied),
      netToPay: Number(total.sub(advanceApplied)),
    };
  }

  async checkout(dto: PosCheckoutDto, cashierId: string) {
    const quoted = await this.quote(dto.clientId, dto.lines);
    await this.consignes.assertWithinLimit(quoted.client.id, quoted.consigneQuantity);

    return this.prisma.$transaction(async (tx) => {
      const saleNumber = await this.nextNumber(tx, 'POS');
      const orderNumber = await this.nextNumber(tx, 'CMD');

      const order = await tx.order.create({
        data: {
          orderNumber,
          clientId: quoted.client.id,
          notes: [`Vente comptoir ${saleNumber}`, dto.notes?.trim()].filter(Boolean).join(' - '),
          totalAmount: quoted.total,
          consigneAmount: quoted.consigneAmount,
          status: OrderStatus.LIVREE,
          lines: {
            create: quoted.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              bonusQuantity: l.bonusQuantity,
              bonus: l.bonus,
              emptiesReturned: l.emptiesReturned,
              consigneQuantity: l.consigneQuantity,
              consigneAmount: l.consigneAmount,
            })),
          },
        },
      });

      // L'avance disponible solde d'abord le ticket ; seul le reliquat est
      // encaisse, et le montant retenu fait foi sur celui affiche au devis.
      const advanceApplied = await this.allocations.consumeAdvance(
        tx,
        order.id,
        quoted.client.id,
      );
      const netToPay = new Prisma.Decimal(quoted.total).sub(advanceApplied);
      const requested = dto.amountPaid != null
        ? new Prisma.Decimal(dto.amountPaid)
        : netToPay;
      if (netToPay.gt(0) && requested.lte(0)) {
        throw new BadRequestException('Le montant a encaisser doit etre positif');
      }
      const toCollect = netToPay.lte(0) ? new Prisma.Decimal(0) : Prisma.Decimal.min(requested, netToPay);

      if (toCollect.gt(0) && dto.method === PaymentMethod.ESPECES) {
        const received = new Prisma.Decimal(dto.cashReceived ?? Number(toCollect));
        if (received.add(0.001).lt(toCollect)) {
          throw new BadRequestException('Le montant recu est inferieur au versement');
        }
      }

      const cashReceived = dto.method === PaymentMethod.ESPECES
        ? new Prisma.Decimal(dto.cashReceived ?? Number(toCollect))
        : null;
      const changeGiven = cashReceived
        ? cashReceived.sub(toCollect).toDecimalPlaces(2)
        : null;

      const payment = toCollect.gt(0)
        ? await tx.payment.create({
          data: {
            paymentNumber: await this.nextNumber(tx, 'PAY'),
            orderId: order.id,
            clientId: quoted.client.id,
            amount: toCollect,
            method: dto.method,
            reference: dto.reference?.trim() || saleNumber,
            collectedBy: cashierId,
            syncStatus: SyncStatus.SYNCED,
          },
        })
        : null;
      if (payment) await this.allocations.allocatePayment(tx, payment.id);

      const sale = await tx.posSale.create({
        data: {
          saleNumber,
          clientId: quoted.client.id,
          cashierId,
          orderId: order.id,
          paymentId: payment?.id ?? null,
          method: dto.method,
          status: PosSaleStatus.PAYEE,
          subtotal: quoted.subtotal,
          bonus: quoted.bonus,
          consigneAmount: quoted.consigneAmount,
          advanceApplied,
          totalAmount: quoted.total,
          cashReceived,
          changeGiven,
          notes: dto.notes?.trim() || null,
          lines: {
            create: quoted.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              catalogPrice: l.catalogPrice,
              unitPrice: l.unitPrice,
              bonusQuantity: l.bonusQuantity,
              bonus: l.bonus,
              emptiesReturned: l.emptiesReturned,
              consigneQuantity: l.consigneQuantity,
              consigneAmount: l.consigneAmount,
            })),
          },
        },
        include: SALE_INCLUDE,
      });

      await this.adjustFinishedGoods(tx, quoted.lines, -1);
      for (const line of quoted.lines) {
        if (!line.isReusable) continue;
        await this.consignes.recordMovement({
          clientId: quoted.client.id,
          orderId: order.id,
          posSaleId: sale.id,
          productFormat: line.format as ProductFormat,
          source: ConsigneMovementSource.POS,
          qtyIn: line.emptiesReturned,
          qtyOut: line.quantity + line.bonusQuantity,
          tx,
        });
      }
      const points = quoted.lines.reduce((s, l) => s + l.quantity, 0);
      if (points > 0) {
        await tx.client.update({
          where: { id: quoted.client.id },
          data: { loyaltyPoints: { increment: points } },
        });
      }
      return sale;
    }).then(async (sale) => {
      await this.notifications.notifyRoles(
        [UserRole.ADMIN, UserRole.CAISSIER, UserRole.COMPTABLE, UserRole.COMMERCIAL],
        {
          title: 'Vente caisse',
          message: `${sale.saleNumber} — ${sale.client.name} : ${sale.totalAmount}`,
          type: NotificationType.SUCCESS,
          category: NotificationCategory.PAIEMENT,
          link: '/pos',
        },
      );
      if (sale.payment) {
        void this.finance
          .postFromPayment({
            paymentId: sale.payment.id,
            // Seul le reliquat encaisse entre en caisse : la part reglee par
            // l'avance a deja ete comptabilisee lors de son versement.
            amount: Number(sale.payment.amount),
            method: sale.method,
            reference: sale.payment.paymentNumber,
            label: `Vente caisse ${sale.saleNumber}`,
            collectedBy: sale.cashier.id,
          })
          .catch(() => undefined);
      }
      return sale;
    });
  }

  async recordAdvance(dto: PosAdvanceDto, cashierId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client || !client.isActive) throw new NotFoundException('Client introuvable');
    if (client.code === WALK_IN_CODE) {
      throw new BadRequestException('Une avance necessite un client identifie');
    }
    return this.payments.create({
      clientId: dto.clientId,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference?.trim() || 'POS-AVANCE',
      asAdvance: true,
    }, cashierId);
  }

  async recordAcompte(dto: PosAcompteDto, cashierId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status === OrderStatus.ANNULEE) {
      throw new BadRequestException('Cette commande est annulee');
    }
    const remaining = new Prisma.Decimal(order.totalAmount).sub(order.paidAmount ?? 0);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Le montant doit etre positif');
    }
    if (amount.gt(remaining)) {
      throw new BadRequestException(`Le montant depasse le reste a payer (${remaining})`);
    }
    if (dto.method === PaymentMethod.ESPECES) {
      const received = new Prisma.Decimal(dto.cashReceived ?? dto.amount);
      if (received.add(0.001).lt(amount)) {
        throw new BadRequestException('Le montant recu est inferieur au versement');
      }
    }
    return this.payments.create({
      orderId: dto.orderId,
      clientId: order.clientId,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference?.trim() || `POS-ACOMPTE-${order.orderNumber}`,
    }, cashierId);
  }

  async cancel(id: string) {
    const sale = await this.findOne(id);
    if (sale.status !== PosSaleStatus.PAYEE) {
      throw new BadRequestException('Cette vente est deja annulee');
    }
    return this.prisma.$transaction(async (tx) => {
      if (sale.orderId) {
        await tx.order.update({
          where: { id: sale.orderId },
          data: { status: OrderStatus.ANNULEE },
        });
        // L'encaissement reste acquis mais n'a plus d'objet : il devient une
        // avance au credit du client, a rembourser ou a imputer plus tard.
        await this.allocations.clearAllocations(tx, { orderId: sale.orderId });
        await this.allocations.refreshOrder(tx, sale.orderId);
        await this.allocations.refreshClient(tx, sale.clientId);
      }
      await this.adjustFinishedGoods(
        tx,
        sale.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          bonusQuantity: l.bonusQuantity,
        })),
        1,
      );
      // On rend au client la situation de consigne d'avant la vente.
      for (const line of sale.lines) {
        if (line.consigneQuantity === 0 && line.emptiesReturned === 0) continue;
        await this.consignes.recordMovement({
          clientId: sale.clientId,
          posSaleId: sale.id,
          productFormat: line.product.format,
          source: ConsigneMovementSource.AJUSTEMENT,
          qtyIn: line.quantity + line.bonusQuantity,
          qtyOut: line.emptiesReturned,
          notes: `Annulation ${sale.saleNumber}`,
          tx,
        });
      }
      return tx.posSale.update({
        where: { id },
        data: { status: PosSaleStatus.ANNULEE },
        include: SALE_INCLUDE,
      });
    }).then(async (updated) => {
      await this.notifications.notifyRoles(
        [UserRole.ADMIN, UserRole.CAISSIER, UserRole.COMPTABLE],
        {
          title: 'Vente caisse annulee',
          message: `${updated.saleNumber} — ${updated.client.name}`,
          type: NotificationType.WARNING,
          category: NotificationCategory.PAIEMENT,
          link: '/pos',
        },
      );
      return updated;
    });
  }

  private mergeLines(lines: PosLineDto[]) {
    const map = new Map<string, { quantity: number; emptiesReturned: number }>();
    for (const line of lines) {
      const current = map.get(line.productId) ?? { quantity: 0, emptiesReturned: 0 };
      current.quantity += line.quantity;
      current.emptiesReturned += Math.max(0, Math.floor(line.emptiesReturned ?? 0));
      map.set(line.productId, current);
    }
    return [...map.entries()].map(([productId, values]) => ({ productId, ...values }));
  }

  private async resolveClient(clientId?: string | null) {
    if (clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: clientId } });
      if (!client || !client.isActive) throw new NotFoundException('Client introuvable');
      return client;
    }
    return this.ensureWalkInClient();
  }

  private async ensureWalkInClient() {
    return this.prisma.client.upsert({
      where: { code: WALK_IN_CODE },
      update: {},
      create: {
        code: WALK_IN_CODE,
        name: 'Comptoir / passage',
        segment: ClientSegment.PARTICULIER,
        city: 'Kinshasa',
        zone: 'Comptoir',
        consigneLimit: 0,
      },
    });
  }

  private async nextNumber(tx: Prisma.TransactionClient, prefix: 'POS' | 'CMD' | 'PAY') {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = prefix === 'POS'
      ? await tx.posSale.count()
      : prefix === 'CMD'
        ? await tx.order.count()
        : await tx.payment.count();
    return `${prefix}-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  private async adjustFinishedGoods(
    tx: Prisma.TransactionClient,
    lines: Array<{ productId: string; quantity: number; bonusQuantity?: number }>,
    sign: 1 | -1,
  ) {
    const location = await tx.stockLocation.findFirst({
      where: { OR: [{ code: 'PF-01' }, { type: StockLocationType.PRODUITS_FINIS }] },
      orderBy: { code: 'asc' },
    });
    if (!location) return;
    for (const line of lines) {
      const item = await tx.stockItem.findFirst({
        where: { productId: line.productId, locationId: location.id },
      });
      if (!item) continue;
      const next = item.quantity + sign * (line.quantity + (line.bonusQuantity ?? 0));
      await tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: next < 0 ? 0 : next },
      });
    }
  }
}
