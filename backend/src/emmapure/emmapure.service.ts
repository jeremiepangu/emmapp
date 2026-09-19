import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LoyaltyTier,
  LotStatus,
  NotificationCategory,
  NotificationType,
  ProductionOrderStatus,
  QualityCheckStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EmmapureService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

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
    const created = await this.prisma.productionOrder.create({
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
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.CHEF_PRODUCTION, UserRole.RESP_QUALITE],
      {
        title: 'Ordre de production',
        message: `${created.orderNumber} — ${created.lotNumber}`,
        type: NotificationType.INFO,
        category: NotificationCategory.PRODUCTION,
        link: '/production',
      },
    );
    return created;
  }

  async validateProductionOrder(id: string) {
    const updated = await this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: ProductionOrderStatus.TERMINE,
        lotStatus: LotStatus.LIBERE,
        completedAt: new Date(),
      },
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.CHEF_PRODUCTION, UserRole.MAGASINIER],
      {
        title: 'Lot libere',
        message: `${updated.orderNumber} — ${updated.lotNumber}`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.PRODUCTION,
        link: '/production',
      },
    );
    return updated;
  }

  getQualityChecks() {
    return this.prisma.qualityCheck.findMany({
      orderBy: { createdAt: 'desc' },
      include: { productionOrder: true },
    });
  }

  async createQualityCheck(data: {
    lotNumber: string;
    productionOrderId?: string;
    ph?: number;
    chlorineFree?: number;
    tds?: number;
    turbidity?: number;
    microbiologyOk?: boolean;
  }) {
    const created = await this.prisma.qualityCheck.create({
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
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.RESP_QUALITE, UserRole.CHEF_PRODUCTION],
      {
        title: 'Controle qualite',
        message: `Lot ${created.lotNumber} en attente de validation`,
        type: NotificationType.INFO,
        category: NotificationCategory.QUALITE,
        link: '/quality',
      },
    );
    return created;
  }

  async validateQualityCheck(id: string, conform: boolean, validatedBy: string) {
    const check = await this.prisma.$transaction(async (tx) => {
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
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.RESP_QUALITE, UserRole.CHEF_PRODUCTION],
      {
        title: conform ? 'Lot conforme' : 'Lot non conforme',
        message: `Lot ${check.lotNumber} : ${conform ? 'libere' : 'bloque'}`,
        type: conform ? NotificationType.SUCCESS : NotificationType.ALERT,
        category: NotificationCategory.QUALITE,
        link: '/quality',
      },
    );
    return check;
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
    return this.applyLoyaltyTier(clientId, client.loyaltyPoints);
  }

  async updateLoyalty(
    clientId: string,
    data: { loyaltyPoints?: number; walletBalance?: number },
  ) {
    const client = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        loyaltyPoints: data.loyaltyPoints,
        walletBalance: data.walletBalance,
      },
    });
    return this.applyLoyaltyTier(clientId, client.loyaltyPoints);
  }

  resetLoyalty(clientId: string) {
    return this.updateLoyalty(clientId, { loyaltyPoints: 0 });
  }

  private async applyLoyaltyTier(clientId: string, points: number) {
    let tier: LoyaltyTier = LoyaltyTier.BRONZE;
    if (points >= 500) tier = LoyaltyTier.PLATINE;
    else if (points >= 300) tier = LoyaltyTier.OR;
    else if (points >= 100) tier = LoyaltyTier.ARGENT;
    const previous = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { loyaltyTier: true },
    });
    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { loyaltyTier: tier },
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
    if (previous && previous.loyaltyTier !== updated.loyaltyTier) {
      await this.notifications.notifyRoles(
        [UserRole.ADMIN, UserRole.COMMERCIAL],
        {
          title: 'Palier fidelite',
          message: `${updated.name} passe en ${updated.loyaltyTier}`,
          type: NotificationType.SUCCESS,
          category: NotificationCategory.FIDELITE,
          link: '/loyalty',
        },
      );
    }
    return updated;
  }

  getShiftAssignments(date?: string) {
    const where = date ? { date: new Date(date) } : {};
    return this.prisma.shiftAssignment.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createShiftAssignment(data: {
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    postLabel: string;
    notes?: string;
  }) {
    const created = await this.prisma.shiftAssignment.create({
      data: {
        userId: data.userId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        postLabel: data.postLabel,
        notes: data.notes,
      },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
    await this.notifications.create({
      userId: created.userId,
      title: 'Nouveau shift',
      message: `${created.postLabel} le ${created.date.toISOString().slice(0, 10)}`,
      type: NotificationType.INFO,
      category: NotificationCategory.RH,
      link: '/hr',
    });
    return created;
  }

  async updateShift(
    id: string,
    data: Partial<{ date: string; startTime: string; endTime: string; postLabel: string; notes: string }>,
  ) {
    return this.prisma.shiftAssignment.update({
      where: { id },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        postLabel: data.postLabel,
        notes: data.notes,
      },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
  }

  validateShift(id: string) {
    return this.prisma.shiftAssignment.update({
      where: { id },
      data: { validated: true },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
  }

  deleteShift(id: string) {
    return this.prisma.shiftAssignment.delete({ where: { id } });
  }

  updateProduction(id: string, data: { producedQty?: number; lineCode?: string; plannedQty?: number }) {
    return this.prisma.productionOrder.update({ where: { id }, data });
  }

  deleteProduction(id: string) {
    return this.prisma.productionOrder.delete({ where: { id } });
  }

  deleteQuality(id: string) {
    return this.prisma.qualityCheck.delete({ where: { id } });
  }

  async updateQuality(
    id: string,
    data: {
      lotNumber?: string;
      ph?: number;
      chlorineFree?: number;
      tds?: number;
      turbidity?: number;
      microbiologyOk?: boolean;
      notes?: string;
    },
  ) {
    const check = await this.prisma.qualityCheck.findUnique({ where: { id } });
    if (!check) throw new NotFoundException('Contrôle introuvable');
    if (check.status !== QualityCheckStatus.EN_ATTENTE) {
      throw new BadRequestException('Seul un contrôle en attente peut être modifié');
    }
    return this.prisma.qualityCheck.update({
      where: { id },
      data,
      include: { productionOrder: true },
    });
  }

  createPackaging(data: { barcode: string; productFormat: string; maxRotations: number }) {
    return this.prisma.packagingUnit.create({
      data: {
        barcode: data.barcode,
        productFormat: data.productFormat as never,
        maxRotations: data.maxRotations,
      },
    });
  }

  updatePackaging(id: string, data: { rotationCount?: number; status?: string; maxRotations?: number }) {
    return this.prisma.packagingUnit.update({ where: { id }, data });
  }

  deletePackaging(id: string) {
    return this.prisma.packagingUnit.delete({ where: { id } });
  }

  createFountain(data: { serialNumber: string; model?: string; contractType?: string; nextService?: string }) {
    return this.prisma.fountainAsset.create({
      data: {
        serialNumber: data.serialNumber,
        model: data.model,
        contractType: data.contractType,
        nextService: data.nextService ? new Date(data.nextService) : undefined,
      },
    });
  }

  updateFountain(id: string, data: { model?: string; contractType?: string; nextService?: string; isActive?: boolean }) {
    return this.prisma.fountainAsset.update({
      where: { id },
      data: {
        model: data.model,
        contractType: data.contractType,
        nextService: data.nextService ? new Date(data.nextService) : undefined,
        isActive: data.isActive,
      },
    });
  }

  deleteFountain(id: string) {
    return this.prisma.fountainAsset.update({ where: { id }, data: { isActive: false } });
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
