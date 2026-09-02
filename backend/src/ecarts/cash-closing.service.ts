import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashClosingStatus,
  DiscrepancyKind,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { DiscrepanciesService } from './discrepancies.service';

/** Encaissements consideres comme especes en caisse. */
const CASH_METHODS: PaymentMethod[] = [PaymentMethod.ESPECES];

const CLOSING_INCLUDE = {
  cashier: { select: { id: true, firstName: true, lastName: true } },
  discrepancies: true,
} as const;

@Injectable()
export class CashClosingService {
  constructor(
    private prisma: PrismaService,
    private discrepancies: DiscrepanciesService,
  ) {}

  findAll(params?: { cashierId?: string }) {
    return this.prisma.cashClosing.findMany({
      where: { cashierId: params?.cashierId },
      include: CLOSING_INCLUDE,
      orderBy: { openedAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const closing = await this.prisma.cashClosing.findUnique({
      where: { id },
      include: CLOSING_INCLUDE,
    });
    if (!closing) throw new NotFoundException('Session de caisse introuvable');
    return closing;
  }

  /** Session en cours d'un caissier, s'il en a une. */
  current(cashierId: string) {
    return this.prisma.cashClosing.findFirst({
      where: { cashierId, status: CashClosingStatus.OUVERTE },
      include: CLOSING_INCLUDE,
      orderBy: { openedAt: 'desc' },
    });
  }

  async open(cashierId: string, notes?: string) {
    const existing = await this.current(cashierId);
    if (existing) {
      throw new BadRequestException('Une session de caisse est deja ouverte');
    }
    return this.prisma.cashClosing.create({
      data: {
        reference: await this.nextReference(),
        cashierId,
        openedAt: new Date(),
        notes,
      },
      include: CLOSING_INCLUDE,
    });
  }

  /**
   * Montant theorique en caisse : encaissements en especes du caissier
   * depuis l'ouverture de la session.
   */
  async expectedAmount(cashierId: string, from: Date, to: Date = new Date()) {
    const result = await this.prisma.payment.aggregate({
      where: {
        collectedBy: cashierId,
        method: { in: CASH_METHODS },
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });
    return new Prisma.Decimal(result._sum.amount ?? 0);
  }

  async close(id: string, countedAmount: number, notes?: string) {
    const closing = await this.findOne(id);
    if (closing.status !== CashClosingStatus.OUVERTE) {
      throw new BadRequestException('Cette session est deja cloturee');
    }
    const closedAt = new Date();
    const expected = await this.expectedAmount(closing.cashierId, closing.openedAt, closedAt);
    const counted = new Prisma.Decimal(countedAmount);
    const variance = counted.sub(expected);

    const updated = await this.prisma.cashClosing.update({
      where: { id },
      data: {
        closedAt,
        expectedAmount: expected,
        countedAmount: counted,
        variance,
        status: CashClosingStatus.CLOTUREE,
        notes: notes ?? closing.notes,
      },
      include: CLOSING_INCLUDE,
    });

    await this.discrepancies.record({
      kind: DiscrepancyKind.CAISSE,
      reference: updated.reference,
      label: `Cloture ${updated.reference} — ${closing.cashier.firstName} ${closing.cashier.lastName}`,
      expected,
      actual: counted,
      cashClosingId: updated.id,
    });

    return this.findOne(id);
  }

  async validate(id: string) {
    const closing = await this.findOne(id);
    if (closing.status !== CashClosingStatus.CLOTUREE) {
      throw new BadRequestException('Seule une session cloturee peut etre validee');
    }
    return this.prisma.cashClosing.update({
      where: { id },
      data: { status: CashClosingStatus.VALIDEE },
      include: CLOSING_INCLUDE,
    });
  }

  private async nextReference() {
    const count = await this.prisma.cashClosing.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `CAI-${date}-${String(count + 1).padStart(4, '0')}`;
  }
}
