import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientSegment,
  NotificationCategory,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  PosSaleStatus,
  Prisma,
  StockLocationType,
  SyncStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceService } from '../finance/finance.service';
import { PosCheckoutDto, PosLineDto } from './dto/pos.dto';

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
    private notifications: NotificationsService,
    private finance: FinanceService,
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
      discount: number;
      lineTotal: number;
      ruleName: string | null;
    }> = [];
    let subtotal = new Prisma.Decimal(0);
    let discount = new Prisma.Decimal(0);
    for (const line of this.mergeLines(lines)) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product || !product.isActive) {
        throw new NotFoundException(`Produit ${line.productId} introuvable`);
      }
      const result = await this.pricing.priceLine(ctx, product, line.quantity);
      const lineTotal = result.unitPrice.mul(line.quantity);
      subtotal = subtotal.add(result.catalogPrice.mul(line.quantity));
      discount = discount.add(result.discount);
      priced.push({
        productId: product.id,
        code: product.code,
        name: product.name,
        format: product.format,
        quantity: line.quantity,
        catalogPrice: Number(result.catalogPrice),
        unitPrice: Number(result.unitPrice),
        discount: Number(result.discount),
        lineTotal: Number(lineTotal),
        ruleName: result.ruleName,
      });
    }
    const total = subtotal.sub(discount);
    return {
      client: { id: client.id, code: client.code, name: client.name, segment: client.segment },
      lines: priced,
      subtotal: Number(subtotal),
      discount: Number(discount),
      total: Number(total.toDecimalPlaces(2)),
    };
  }

  async checkout(dto: PosCheckoutDto, cashierId: string) {
    const quoted = await this.quote(dto.clientId, dto.lines);
    if (dto.method === PaymentMethod.ESPECES) {
      const received = dto.cashReceived ?? quoted.total;
      if (received + 0.001 < quoted.total) {
        throw new BadRequestException('Le montant recu est inferieur au total');
      }
    }
    const cashReceived = dto.method === PaymentMethod.ESPECES
      ? new Prisma.Decimal(dto.cashReceived ?? quoted.total)
      : null;
    const changeGiven = cashReceived
      ? cashReceived.sub(quoted.total).toDecimalPlaces(2)
      : null;

    return this.prisma.$transaction(async (tx) => {
      const saleNumber = await this.nextNumber(tx, 'POS');
      const orderNumber = await this.nextNumber(tx, 'CMD');
      const paymentNumber = await this.nextNumber(tx, 'PAY');

      const order = await tx.order.create({
        data: {
          orderNumber,
          clientId: quoted.client.id,
          notes: [`Vente comptoir ${saleNumber}`, dto.notes?.trim()].filter(Boolean).join(' - '),
          totalAmount: quoted.total,
          status: OrderStatus.LIVREE,
          lines: {
            create: quoted.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
            })),
          },
        },
      });

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          orderId: order.id,
          clientId: quoted.client.id,
          amount: quoted.total,
          method: dto.method,
          reference: dto.reference?.trim() || saleNumber,
          collectedBy: cashierId,
          syncStatus: SyncStatus.SYNCED,
        },
      });

      const sale = await tx.posSale.create({
        data: {
          saleNumber,
          clientId: quoted.client.id,
          cashierId,
          orderId: order.id,
          paymentId: payment.id,
          method: dto.method,
          status: PosSaleStatus.PAYEE,
          subtotal: quoted.subtotal,
          discount: quoted.discount,
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
              discount: l.discount,
            })),
          },
        },
        include: SALE_INCLUDE,
      });

      await this.adjustFinishedGoods(tx, quoted.lines, -1);
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
            amount: Number(sale.totalAmount),
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
      }
      await this.adjustFinishedGoods(
        tx,
        sale.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        1,
      );
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
    const map = new Map<string, number>();
    for (const line of lines) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
    }
    return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
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
    lines: Array<{ productId: string; quantity: number }>,
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
      const next = item.quantity + sign * line.quantity;
      await tx.stockItem.update({
        where: { id: item.id },
        data: { quantity: next < 0 ? 0 : next },
      });
    }
  }
}
