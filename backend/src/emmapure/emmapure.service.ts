import { Injectable } from '@nestjs/common';
import { LoyaltyTier, LotStatus, ProductionOrderStatus, QualityCheckStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class EmmapureService {
  constructor(private prisma: PrismaService) {}

  getProductionOrders() {
    return this.prisma.productionOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { qualityChecks: true },
    });
  }

  async createProductionOrder(data: {
    productFormat: string;
    lineCode: string;
    plannedQty: number;
  }) {
    const date = new Date();
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.productionOrder.count();
    const lotNumber = `LOT-${stamp}-${data.lineCode}-${data.productFormat}-${String(count + 1).padStart(3, '0')}`;
    return this.prisma.productionOrder.create({
      data: {
        orderNumber: `OF-${stamp}-${String(count + 1).padStart(4, '0')}`,
        lotNumber,
        productFormat: data.productFormat as never,
        lineCode: data.lineCode,
        plannedQty: data.plannedQty,
        status: ProductionOrderStatus.PLANIFIE,
        lotStatus: LotStatus.EN_PRODUCTION,
      },
    });
  }

  validateProductionOrder(id: string) {
    return this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: ProductionOrderStatus.TERMINE,
        lotStatus: LotStatus.LIBERE,
        completedAt: new Date(),
      },
    });
  }

  getQualityChecks() {
    return this.prisma.qualityCheck.findMany({
      orderBy: { createdAt: 'desc' },
      include: { productionOrder: true },
    });
  }

  createQualityCheck(data: {
    lotNumber: string;
    productionOrderId?: string;
    ph?: number;
    chlorineFree?: number;
    tds?: number;
    turbidity?: number;
    microbiologyOk?: boolean;
  }) {
    return this.prisma.qualityCheck.create({
      data: {
        lotNumber: data.lotNumber,
        productionOrderId: data.productionOrderId,
        ph: data.ph,
        chlorineFree: data.chlorineFree,
        tds: data.tds,
        turbidity: data.turbidity,
        microbiologyOk: data.microbiologyOk,
        status: QualityCheckStatus.EN_ATTENTE,
      },
    });
  }

  validateQualityCheck(id: string, conform: boolean, validatedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const check = await tx.qualityCheck.update({
        where: { id },
        data: {
          status: conform ? QualityCheckStatus.CONFORME : QualityCheckStatus.NON_CONFORME,
          validatedBy,
          validatedAt: new Date(),
        },
      });
      if (check.productionOrderId) {
        await tx.productionOrder.update({
          where: { id: check.productionOrderId },
          data: {
            lotStatus: conform ? LotStatus.LIBERE : LotStatus.BLOQUE,
            status: conform ? ProductionOrderStatus.TERMINE : ProductionOrderStatus.BLOQUE,
          },
        });
      }
      return check;
    });
  }

  getLoyaltyClients() {
    return this.prisma.client.findMany({
      where: { isActive: true },
      orderBy: { loyaltyPoints: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        segment: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        walletBalance: true,
      },
    });
  }

  async creditLoyalty(clientId: string, points: number) {
    const client = await this.prisma.client.update({
      where: { id: clientId },
      data: { loyaltyPoints: { increment: points } },
    });
    let tier: LoyaltyTier = LoyaltyTier.BRONZE;
    if (client.loyaltyPoints >= 500) tier = LoyaltyTier.PLATINE;
    else if (client.loyaltyPoints >= 300) tier = LoyaltyTier.OR;
    else if (client.loyaltyPoints >= 100) tier = LoyaltyTier.ARGENT;
    return this.prisma.client.update({
      where: { id: clientId },
      data: { loyaltyTier: tier },
    });
  }

  getShiftAssignments(date?: string) {
    const where = date ? { date: new Date(date) } : {};
    return this.prisma.shiftAssignment.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  createShiftAssignment(data: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    postLabel: string;
    notes?: string;
  }) {
    return this.prisma.shiftAssignment.create({
      data: {
        userId: data.userId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        postLabel: data.postLabel,
        notes: data.notes,
      },
    });
  }

  getPackagingUnits() {
    return this.prisma.packagingUnit.findMany({ orderBy: { rotationCount: 'desc' } });
  }

  getFountains() {
    return this.prisma.fountainAsset.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getObservability() {
    const [pendingSync, blockedLots, openQuality, uncoveredShifts] = await Promise.all([
      this.prisma.syncEvent.count({ where: { status: 'PENDING' } }),
      this.prisma.productionOrder.count({ where: { lotStatus: LotStatus.BLOQUE } }),
      this.prisma.qualityCheck.count({ where: { status: QualityCheckStatus.EN_ATTENTE } }),
      this.prisma.shiftAssignment.count({ where: { validated: false } }),
    ]);
    return {
      apiStatus: 'ok',
      pendingSync,
      blockedLots,
      openQualityChecks: openQuality,
      pendingShiftValidations: uncoveredShifts,
      services: [
        { name: 'API NestJS', status: 'UP' },
        { name: 'PostgreSQL', status: 'UP' },
        { name: 'Web PWA', status: 'UP' },
        { name: 'Sync mobile', status: pendingSync > 0 ? 'WARN' : 'UP' },
      ],
    };
  }
}
