import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus, NotificationCategory, NotificationType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateActivityObjectiveDto, UpdateActivityObjectiveDto } from './dto/objective.dto';

const INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
  activity: {
    select: {
      id: true,
      name: true,
      jobFunction: { select: { id: true, name: true, department: true } },
    },
  },
} as const;

const MANAGERS: UserRole[] = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.DG,
  UserRole.SUPERVISEUR,
  UserRole.CHEF_EXPLOITATION,
  UserRole.CHEF_PRODUCTION,
  UserRole.COMMERCIAL,
];

@Injectable()
export class ObjectivesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async list(actor: { id: string; role: UserRole }, query: { userId?: string; year?: number; month?: number }) {
    const year = query.year ?? new Date().getFullYear();
    const where: Prisma.AgentActivityObjectiveWhereInput = { year, isActive: true };
    if (!MANAGERS.includes(actor.role)) {
      where.userId = actor.id;
    } else if (query.userId) {
      where.userId = query.userId;
    }
    if (query.month) {
      const quarter = Math.ceil(query.month / 3);
      where.OR = [
        { periodType: 'MENSUEL', month: query.month },
        { periodType: 'TRIMESTRIEL', quarter },
        { periodType: 'ANNUEL' },
      ];
    }
    const rows = await this.prisma.agentActivityObjective.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ year: 'desc' }, { month: 'asc' }, { title: 'asc' }],
    });
    return Promise.all(rows.map((row) => this.withProgress(row)));
  }

  async catalog() {
    const [users, functions] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.jobFunction.findMany({
        where: { isActive: true },
        include: { activities: { orderBy: { name: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { users, functions };
  }

  async findOne(id: string) {
    const row = await this.prisma.agentActivityObjective.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException('Objectif introuvable');
    return this.withProgress(row);
  }

  async create(dto: CreateActivityObjectiveDto) {
    await this.assertRefs(dto.userId, dto.activityId);
    const periodType = dto.periodType ?? 'MENSUEL';
    const month = periodType === 'MENSUEL' ? (dto.month ?? new Date().getMonth() + 1) : null;
    const quarter = periodType === 'TRIMESTRIEL' ? (dto.quarter ?? Math.ceil((new Date().getMonth() + 1) / 3)) : null;
    this.assertPeriod(periodType, month, quarter);
    const created = await this.prisma.agentActivityObjective.create({
      data: {
        userId: dto.userId,
        activityId: dto.activityId,
        title: dto.title.trim(),
        periodType,
        year: dto.year,
        month,
        quarter,
        targetValue: dto.targetValue,
        unit: dto.unit ?? 'DECLARATION',
        notes: dto.notes?.trim() || null,
      },
      include: INCLUDE,
    });
    const payload = {
      title: 'Objectif assigne',
      message: `${created.title} — ${created.user.firstName} ${created.user.lastName}`,
      type: NotificationType.INFO,
      category: NotificationCategory.SUPERVISION,
      link: '/objectives',
    };
    await this.notifications.create({ ...payload, userId: created.userId });
    await this.notifications.notifyRoles(MANAGERS, payload);
    return this.withProgress(created);
  }

  async update(id: string, dto: UpdateActivityObjectiveDto) {
    const current = await this.findOne(id);
    if (dto.userId || dto.activityId) {
      await this.assertRefs(dto.userId ?? current.userId, dto.activityId ?? current.activityId);
    }
    const periodType = dto.periodType ?? current.periodType;
    this.assertPeriod(periodType, dto.month === undefined ? current.month : dto.month, dto.quarter === undefined ? current.quarter : dto.quarter);
    const updated = await this.prisma.agentActivityObjective.update({
      where: { id },
      data: {
        userId: dto.userId,
        activityId: dto.activityId,
        title: dto.title?.trim(),
        periodType: dto.periodType,
        year: dto.year,
        month: dto.month === undefined ? undefined : dto.month,
        quarter: dto.quarter === undefined ? undefined : dto.quarter,
        targetValue: dto.targetValue,
        unit: dto.unit,
        notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
      },
      include: INCLUDE,
    });
    return this.withProgress(updated);
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.agentActivityObjective.update({
      where: { id },
      data: { isActive: false },
      include: INCLUDE,
    });
  }

  private assertPeriod(periodType: string, month?: number | null, quarter?: number | null) {
    if (periodType === 'MENSUEL' && !month) {
      throw new BadRequestException('Le mois est requis pour un objectif mensuel');
    }
    if (periodType === 'TRIMESTRIEL' && !quarter) {
      throw new BadRequestException('Le trimestre est requis pour un objectif trimestriel');
    }
  }

  private async assertRefs(userId: string, activityId: string) {
    const [user, activity] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.jobFunctionActivity.findUnique({ where: { id: activityId } }),
    ]);
    if (!user || !user.isActive) throw new NotFoundException('Agent introuvable');
    if (!activity) throw new NotFoundException('Activite introuvable');
  }

  private periodBounds(row: { periodType: string; year: number; month: number | null; quarter: number | null }) {
    if (row.periodType === 'ANNUEL') {
      return { start: new Date(Date.UTC(row.year, 0, 1)), end: new Date(Date.UTC(row.year + 1, 0, 1)) };
    }
    if (row.periodType === 'TRIMESTRIEL') {
      const q = row.quarter ?? 1;
      const startMonth = (q - 1) * 3;
      return { start: new Date(Date.UTC(row.year, startMonth, 1)), end: new Date(Date.UTC(row.year, startMonth + 3, 1)) };
    }
    const month = (row.month ?? 1) - 1;
    return { start: new Date(Date.UTC(row.year, month, 1)), end: new Date(Date.UTC(row.year, month + 1, 1)) };
  }

  private async actualValue(row: {
    userId: string;
    activityId: string;
    unit: string;
    periodType: string;
    year: number;
    month: number | null;
    quarter: number | null;
  }) {
    const { start, end } = this.periodBounds(row);
    if (row.unit === 'LIVRAISON') {
      return this.prisma.delivery.count({
        where: { driverId: row.userId, createdAt: { gte: start, lt: end } },
      });
    }
    if (row.unit === 'UNITE') {
      const agg = await this.prisma.orderLine.aggregate({
        _sum: { quantity: true },
        where: {
          order: { tour: { driverId: row.userId, date: { gte: start, lt: end } } },
        },
      });
      return agg._sum.quantity ?? 0;
    }
    if (row.unit === 'CA') {
      const agg = await this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { tour: { driverId: row.userId, date: { gte: start, lt: end } } },
      });
      return Number(agg._sum.totalAmount ?? 0);
    }
    return this.prisma.activityDeclaration.count({
      where: {
        userId: row.userId,
        activityId: row.activityId,
        status: LeaveStatus.VALIDEE,
        date: { gte: start, lt: end },
      },
    });
  }

  private async withProgress<T extends {
    id: string;
    userId: string;
    activityId: string;
    unit: string;
    targetValue: Prisma.Decimal;
    periodType: string;
    year: number;
    month: number | null;
    quarter: number | null;
  }>(row: T) {
    const actual = Number(await this.actualValue(row));
    const target = Number(row.targetValue);
    const progressPct = target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;
    return {
      ...row,
      targetValue: target,
      actualValue: actual,
      remaining: Math.max(0, target - actual),
      progressPct,
      status: actual >= target && target > 0 ? 'ATTEINT' : progressPct >= 70 ? 'EN_COURS' : 'EN_RETARD',
    };
  }
}
