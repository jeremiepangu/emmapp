import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderStatus, Prisma } from '@prisma/client';
import { Public } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.module';
import { ApiKeyGuard, ApiScopes } from './api-key.guard';

@ApiTags('public')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('public')
export class PublicApiController {
  constructor(private prisma: PrismaService) {}

  @ApiScopes('catalogue')
  @Get('products')
  products() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      select: { code: true, name: true, format: true, unitPrice: true, isReusable: true, consigneAmount: true },
    });
  }

  @ApiScopes('commandes')
  @Get('orders/:reference')
  async order(@Param('reference') reference: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: reference },
      select: { orderNumber: true, status: true, totalAmount: true, createdAt: true, client: { select: { name: true } } },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }

  @ApiScopes('commandes')
  @Post('orders')
  async createOrder(@Body() body: { clientCode: string; lines: Array<{ productCode: string; quantity: number }>; notes?: string }) {
    const client = await this.prisma.client.findUnique({ where: { code: body.clientCode } });
    if (!client) throw new NotFoundException('Client introuvable');
    const count = await this.prisma.order.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let total = new Prisma.Decimal(0);
    const linesData: Array<{ productId: string; quantity: number; unitPrice: Prisma.Decimal; discount: number }> = [];
    for (const line of body.lines ?? []) {
      const product = await this.prisma.product.findUnique({ where: { code: line.productCode } });
      if (!product) throw new NotFoundException(`Produit ${line.productCode} introuvable`);
      total = total.add(product.unitPrice.mul(line.quantity));
      linesData.push({ productId: product.id, quantity: line.quantity, unitPrice: product.unitPrice, discount: 0 });
    }
    return this.prisma.order.create({
      data: {
        orderNumber: `CMD-${date}-${String(count + 1).padStart(4, '0')}`,
        clientId: client.id,
        notes: body.notes,
        totalAmount: total,
        status: OrderStatus.VALIDEE,
        lines: { create: linesData },
      },
      select: { orderNumber: true, status: true, totalAmount: true, createdAt: true },
    });
  }

  @ApiScopes('livraisons')
  @Get('deliveries/:id/tracking')
  async tracking(@Param('id') id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      select: { deliveryNumber: true, status: true, deliveredAt: true, tour: { select: { tourNumber: true } } },
    });
    if (!delivery) throw new NotFoundException('Livraison introuvable');
    return {
      deliveryNumber: delivery.deliveryNumber,
      status: delivery.status,
      deliveredAt: delivery.deliveredAt,
      tourNumber: delivery.tour.tourNumber,
    };
  }
}
