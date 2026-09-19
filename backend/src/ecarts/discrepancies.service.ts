import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DiscrepancyKind,
  DiscrepancyStatus,
  NotificationCategory,
  NotificationType,
  Prisma,
  ProductFormat,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

const DISCREPANCY_INCLUDE = {
  client: { select: { id: true, code: true, name: true } },
  tour: { select: { id: true, tourNumber: true, zone: true } },
  resolvedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export interface RecordDiscrepancyInput {
  kind: DiscrepancyKind;
  reference: string;
  label: string;
  expected: Prisma.Decimal | number;
  actual: Prisma.Decimal | number;
  clientId?: string | null;
  tourId?: string | null;
  cashClosingId?: string | null;
  productFormat?: ProductFormat | null;
  notes?: string;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class DiscrepanciesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Journalise un ecart. Un ecart nul n'est pas enregistre : seul ce qui
   * demande une explication remonte dans le suivi.
   */
  async record(input: RecordDiscrepancyInput) {
    const expected = new Prisma.Decimal(input.expected);
    const actual = new Prisma.Decimal(input.actual);
    const variance = actual.sub(expected);
    if (variance.isZero()) return null;

    const db = input.tx ?? this.prisma;
    const created = await db.discrepancy.create({
      data: {
        kind: input.kind,
        reference: input.reference,
        label: input.label,
        expected,
        actual,
        variance,
        clientId: input.clientId ?? undefined,
        tourId: input.tourId ?? undefined,
        cashClosingId: input.cashClosingId ?? undefined,
        productFormat: input.productFormat ?? undefined,
        notes: input.notes,
      },
    });

    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMPTABLE, UserRole.CHEF_EXPLOITATION],
      {
        title: `Ecart ${input.kind.toLowerCase()}`,
        message: `${input.label} : ${variance.toFixed(2)}`,
        type: NotificationType.WARNING,
        category: NotificationCategory.SYSTEME,
        link: '/ecarts',
      },
    );
    return created;
  }

  findAll(params?: { kind?: DiscrepancyKind; status?: DiscrepancyStatus }) {
    return this.prisma.discrepancy.findMany({
      where: { kind: params?.kind, status: params?.status },
      include: DISCREPANCY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async summary() {
    const rows = await this.prisma.discrepancy.groupBy({
      by: ['kind', 'status'],
      _count: { _all: true },
      _sum: { variance: true },
    });
    return rows.map((r) => ({
      kind: r.kind,
      status: r.status,
      count: r._count._all,
      variance: Number(r._sum.variance ?? 0),
    }));
  }

  async resolve(
    id: string,
    status: DiscrepancyStatus,
    resolvedById: string,
    notes?: string,
  ) {
    const existing = await this.prisma.discrepancy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ecart introuvable');
    return this.prisma.discrepancy.update({
      where: { id },
      data: {
        status,
        notes: notes ?? existing.notes,
        resolvedById: status === DiscrepancyStatus.OUVERT ? null : resolvedById,
        resolvedAt: status === DiscrepancyStatus.OUVERT ? null : new Date(),
      },
      include: DISCREPANCY_INCLUDE,
    });
  }
}
