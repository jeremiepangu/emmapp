import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationCategory, NotificationType, OrderStatus, Prisma, QuoteRequestStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.module';
import { WebhooksService } from '../integrations/webhooks.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private webhooks: WebhooksService,
    private pricing: PricingService,
  ) {}

  findAll(status?: string) {
    return this.prisma.quoteRequest.findMany({
      where: status ? { status: status as QuoteRequestStatus } : undefined,
      include: { client: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(body: {
    companyName: string;
    contactEmail: string;
    contactPhone?: string;
    segment: string;
    zone?: string;
    clientId?: string;
    lines: Array<{ productId: string; quantity: number }>;
    message?: string;
  }) {
    const count = await this.prisma.quoteRequest.count();
    const reference = `DEV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const lines: Array<{ productId: string; productName: string; quantity: number }> = [];
    for (const line of body.lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      lines.push({
        productId: line.productId,
        productName: product?.name ?? line.productId,
        quantity: line.quantity,
      });
    }
    const quote = await this.prisma.quoteRequest.create({
      data: {
        reference,
        companyName: body.companyName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        segment: body.segment as never,
        zone: body.zone,
        clientId: body.clientId,
        lines,
        message: body.message,
      },
      include: { client: { select: { code: true, name: true } } },
    });
    await this.notifications.notifyRoles(
      [UserRole.COMMERCIAL, UserRole.DELEGUE_COMMERCIAL, UserRole.ADMIN],
      {
        title: 'Demande de cotation',
        message: `${quote.companyName} — ${quote.reference}`,
        type: NotificationType.INFO,
        category: NotificationCategory.COMMANDE,
        link: '/marketplace',
      },
    );
    await this.webhooks.dispatch('cotation.recue', { reference: quote.reference, companyName: quote.companyName });
    return quote;
  }

  async update(id: string, userId: string, data: { status?: QuoteRequestStatus; quotedAmount?: number }) {
    const existing = await this.prisma.quoteRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Demande introuvable');
    return this.prisma.quoteRequest.update({
      where: { id },
      data: {
        status: data.status,
        quotedAmount: data.quotedAmount,
        handledById: userId,
      },
      include: { client: { select: { code: true, name: true } } },
    });
  }

  async convert(id: string) {
    const quote = await this.prisma.quoteRequest.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Demande introuvable');
    if (quote.status !== QuoteRequestStatus.ACCEPTEE) {
      throw new BadRequestException('La demande doit être acceptée avant conversion');
    }
    let clientId = quote.clientId;
    if (!clientId) {
      const byEmail = await this.prisma.client.findFirst({ where: { email: quote.contactEmail } });
      clientId = byEmail?.id ?? null;
    }
    if (!clientId) throw new BadRequestException('Aucun client rattaché à cette demande');
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new BadRequestException('Client introuvable');
    const lines = quote.lines as Array<{ productId: string; quantity: number }>;
    const count = await this.prisma.order.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let total = new Prisma.Decimal(0);
    const linesData: Array<{ productId: string; quantity: number; unitPrice: Prisma.Decimal; discount: Prisma.Decimal }> = [];
    for (const line of lines) {
      const product = await this.prisma.product.findUnique({ where: { id: line.productId } });
      if (!product) continue;
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
        orderNumber: `CMD-${date}-${String(count + 1).padStart(4, '0')}`,
        clientId,
        totalAmount: total,
        status: OrderStatus.VALIDEE,
        notes: `Convertie depuis ${quote.reference}`,
        lines: { create: linesData },
      },
      include: { client: true, lines: { include: { product: true } } },
    });
    await this.prisma.quoteRequest.update({ where: { id }, data: { clientId, status: QuoteRequestStatus.ACCEPTEE } });
    await this.notifications.notifyRoles(
      [UserRole.CHEF_EXPLOITATION, UserRole.ADMIN],
      {
        title: 'Cotation convertie',
        message: `${quote.reference} -> ${order.orderNumber}`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.COMMANDE,
        link: '/orders',
      },
    );
    return order;
  }

  async remove(id: string) {
    const quote = await this.prisma.quoteRequest.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Demande introuvable');
    if (quote.status !== QuoteRequestStatus.NOUVELLE && quote.status !== QuoteRequestStatus.REFUSEE) {
      throw new BadRequestException('Seules les demandes nouvelles ou refusées peuvent être supprimées');
    }
    return this.prisma.quoteRequest.delete({ where: { id } });
  }
}
