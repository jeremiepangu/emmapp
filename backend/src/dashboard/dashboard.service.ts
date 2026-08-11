import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      clientsCount,
      ordersToday,
      deliveriesToday,
      paymentsToday,
      activeTours,
      stockItems,
    ] = await Promise.all([
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: today } } }),
      this.prisma.delivery.count({ where: { deliveredAt: { gte: today } } }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      this.prisma.tour.count({
        where: { status: { in: ['EN_COURS', 'EN_CHARGEMENT'] } },
      }),
      this.prisma.stockItem.findMany({
        include: { product: true, location: true },
      }),
    ]);

    const totalStock = stockItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      clientsCount,
      ordersToday,
      deliveriesToday,
      revenueToday: paymentsToday._sum.amount ?? 0,
      activeTours,
      totalStock,
      stockByProduct: stockItems.reduce(
        (acc, item) => {
          const key = item.product.name;
          acc[key] = (acc[key] ?? 0) + item.quantity;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
