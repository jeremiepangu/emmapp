import { Injectable } from '@nestjs/common';
import { NotificationCategory, NotificationType, PaymentMethod, SyncStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceService } from '../finance/finance.service';
import { CreatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private finance: FinanceService,
  ) {}

  private async generatePaymentNumber(): Promise<string> {
    const count = await this.prisma.payment.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `PAY-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  findAll(params?: { deliveryId?: string }) {
    return this.prisma.payment.findMany({
      where: { deliveryId: params?.deliveryId },
      include: {
        client: { select: { name: true } },
        collector: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreatePaymentDto, collectedBy: string) {
    if (dto.localId) {
      const existing = await this.prisma.payment.findUnique({
        where: { localId: dto.localId },
      });
      if (existing) return existing;
    }

    const created = await this.prisma.payment.create({
      data: {
        paymentNumber: await this.generatePaymentNumber(),
        deliveryId: dto.deliveryId,
        clientId: dto.clientId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        collectedBy,
        localId: dto.localId,
        syncStatus: dto.localId ? SyncStatus.SYNCED : SyncStatus.SYNCED,
      },
      include: { client: { select: { name: true } } },
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMPTABLE, UserRole.CAISSIER, UserRole.COMMERCIAL],
      {
        title: 'Paiement recu',
        message: `${created.paymentNumber} — ${created.client?.name ?? created.clientId} : ${created.amount} (${created.method})`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.PAIEMENT,
        link: '/payments',
      },
    );
    void this.finance
      .postFromPayment({
        paymentId: created.id,
        amount: Number(created.amount),
        method: created.method,
        reference: created.reference,
        label: `Encaissement ${created.paymentNumber}`,
        collectedBy,
      })
      .catch(() => undefined);
    return created;
  }

  async update(id: string, data: Partial<{ amount: number; method: PaymentMethod; reference: string }>) {
    return this.prisma.payment.update({
      where: { id },
      data,
      include: {
        client: { select: { name: true } },
        collector: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.payment.delete({ where: { id } });
  }
}
