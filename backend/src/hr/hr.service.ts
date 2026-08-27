import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractType,
  DeliveryStatus,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  PayrollPeriodStatus,
  PayslipStatus,
  NotificationCategory,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
} as const;

const CNSS_RATE = 0.05;
const IPRF_THRESHOLD = 162_000;
const IPRF_RATE = 0.03;
const OVERTIME_RATE = 1.5;

function roundMoney(value: Prisma.Decimal | number): Prisma.Decimal {
  return new Prisma.Decimal(Number(value).toFixed(2));
}

function daysInclusive(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

@Injectable()
export class HrService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  listEmployees() {
    return this.prisma.employeeProfile.findMany({
      include: {
        user: { select: USER_SELECT },
        manager: { select: USER_SELECT },
        jobFunction: true,
      },
      orderBy: { matricule: 'asc' },
    });
  }

  async createEmployee(body: {
    userId: string;
    matricule?: string;
    jobTitle: string;
    department: string;
    contractType?: ContractType;
    hireDate: string;
    endDate?: string;
    baseSalary: number;
    bankName?: string;
    bankAccount?: string;
    cnssNumber?: string;
    nif?: string;
    notes?: string;
    gender?: Prisma.EmployeeProfileCreateInput['gender'];
    birthDate?: string;
    address?: string;
    avenue?: string;
    avenueNumber?: string;
    quartier?: string;
    commune?: string;
    district?: string;
    maritalStatus?: Prisma.EmployeeProfileCreateInput['maritalStatus'];
    emergencyName?: string;
    emergencyPhone?: string;
    photoUrl?: string;
    managerId?: string;
    jobFunctionId?: string;
    annualLeaveDays?: number;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new NotFoundException('Agent introuvable');
    const existing = await this.prisma.employeeProfile.findUnique({ where: { userId: body.userId } });
    if (existing) throw new BadRequestException('Cet agent a déjà un dossier RH');
    const count = await this.prisma.employeeProfile.count();
    const matricule = body.matricule?.trim() || `EMP-${String(count + 1).padStart(4, '0')}`;
    return this.prisma.employeeProfile.create({
      data: {
        userId: body.userId,
        matricule,
        jobTitle: body.jobTitle,
        department: body.department,
        contractType: body.contractType ?? ContractType.CDI,
        hireDate: new Date(body.hireDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        baseSalary: body.baseSalary,
        bankName: body.bankName,
        bankAccount: body.bankAccount,
        cnssNumber: body.cnssNumber,
        nif: body.nif,
        notes: body.notes,
        gender: body.gender,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        address: body.address,
        avenue: body.avenue,
        avenueNumber: body.avenueNumber,
        quartier: body.quartier,
        commune: body.commune,
        district: body.district,
        province: 'KINSHASA',
        maritalStatus: body.maritalStatus,
        emergencyName: body.emergencyName,
        emergencyPhone: body.emergencyPhone,
        photoUrl: body.photoUrl,
        managerId: body.managerId || null,
        jobFunctionId: body.jobFunctionId || null,
        annualLeaveDays: body.annualLeaveDays ?? 24,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async updateEmployee(
    id: string,
    body: Partial<{
      jobTitle: string;
      department: string;
      contractType: ContractType;
      hireDate: string;
      endDate: string | null;
      baseSalary: number;
      bankName: string;
      bankAccount: string;
      cnssNumber: string;
      nif: string;
      status: EmployeeStatus;
      notes: string;
      gender: Prisma.EmployeeProfileUpdateInput['gender'];
      birthDate: string | null;
      address: string;
      avenue: string;
      avenueNumber: string;
      quartier: string;
      commune: string;
      district: string;
      maritalStatus: Prisma.EmployeeProfileUpdateInput['maritalStatus'];
      emergencyName: string;
      emergencyPhone: string;
      photoUrl: string;
      managerId: string | null;
      jobFunctionId: string | null;
      annualLeaveDays: number;
    }>,
    actorId?: string,
  ) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Dossier RH introuvable');
    const next = {
      jobTitle: body.jobTitle,
      department: body.department,
      contractType: body.contractType,
      hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
      endDate: body.endDate === null ? null : body.endDate ? new Date(body.endDate) : undefined,
      baseSalary: body.baseSalary,
      bankName: body.bankName,
      bankAccount: body.bankAccount,
      cnssNumber: body.cnssNumber,
      nif: body.nif,
      status: body.status,
      notes: body.notes,
      gender: body.gender as never,
      birthDate: body.birthDate === null ? null : body.birthDate ? new Date(body.birthDate) : undefined,
      address: body.address,
      avenue: body.avenue,
      avenueNumber: body.avenueNumber,
      quartier: body.quartier,
      commune: body.commune,
      district: body.district,
      maritalStatus: body.maritalStatus as never,
      emergencyName: body.emergencyName,
      emergencyPhone: body.emergencyPhone,
      photoUrl: body.photoUrl,
      managerId: body.managerId === undefined ? undefined : body.managerId,
      jobFunctionId: body.jobFunctionId === undefined ? undefined : body.jobFunctionId,
      annualLeaveDays: body.annualLeaveDays,
    };
    if (actorId) {
      const tracked: Array<[string, unknown, unknown]> = [
        ['jobTitle', profile.jobTitle, body.jobTitle],
        ['department', profile.department, body.department],
        ['contractType', profile.contractType, body.contractType],
        ['status', profile.status, body.status],
        ['baseSalary', String(profile.baseSalary), body.baseSalary != null ? String(body.baseSalary) : undefined],
        ['managerId', profile.managerId, body.managerId],
        ['jobFunctionId', profile.jobFunctionId, body.jobFunctionId],
      ];
      await this.prisma.employeeFieldHistory.createMany({
        data: tracked
          .filter(([, oldV, newV]) => newV !== undefined && String(oldV ?? '') !== String(newV ?? ''))
          .map(([field, oldV, newV]) => ({
            employeeId: id,
            field,
            oldValue: oldV == null ? null : String(oldV),
            newValue: newV == null ? null : String(newV),
            actorId,
          })),
      });
    }
    return this.prisma.employeeProfile.update({
      where: { id },
      data: next,
      include: { user: { select: USER_SELECT }, manager: { select: USER_SELECT }, jobFunction: true },
    });
  }

  async deleteEmployee(id: string) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Dossier RH introuvable');
    return this.prisma.employeeProfile.update({
      where: { id },
      data: { status: EmployeeStatus.SORTI, endDate: profile.endDate ?? new Date() },
      include: { user: { select: USER_SELECT } },
    });
  }

  listLeaves() {
    return this.prisma.leaveRequest.findMany({
      include: {
        user: { select: USER_SELECT },
        validatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createLeave(body: {
    userId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
  }) {
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) throw new BadRequestException('La date de fin précède la date de début');
    const created = await this.prisma.leaveRequest.create({
      data: {
        userId: body.userId,
        type: body.type,
        startDate: start,
        endDate: end,
        days: daysInclusive(start, end),
        reason: body.reason,
        status: LeaveStatus.SOUMISE,
      },
      include: { user: { select: USER_SELECT } },
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.RH, UserRole.SUPERVISEUR],
      {
        title: 'Demande de conge',
        message: `${created.user.firstName} ${created.user.lastName} — ${created.type} (${created.days} j)`,
        type: NotificationType.INFO,
        category: NotificationCategory.RH,
        link: '/hr',
      },
    );
    return created;
  }

  async updateLeave(
    id: string,
    body: Partial<{ type: LeaveType; startDate: string; endDate: string; reason: string }>,
  ) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Demande introuvable');
    if (leave.status === LeaveStatus.VALIDEE || leave.status === LeaveStatus.REJETEE) {
      throw new BadRequestException('Demande déjà traitée');
    }
    const start = body.startDate ? new Date(body.startDate) : leave.startDate;
    const end = body.endDate ? new Date(body.endDate) : leave.endDate;
    if (end < start) throw new BadRequestException('La date de fin précède la date de début');
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        type: body.type,
        startDate: start,
        endDate: end,
        days: daysInclusive(start, end),
        reason: body.reason,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async decideLeave(id: string, approve: boolean, actorId: string, reason?: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: { include: { employeeProfile: true } } },
    });
    if (!leave) throw new NotFoundException('Demande introuvable');
    if (leave.status !== LeaveStatus.SOUMISE && leave.status !== LeaveStatus.VALIDEE_MANAGER) {
      throw new BadRequestException('Cette demande n’est plus en attente');
    }
    if (!approve && !reason?.trim()) {
      throw new BadRequestException('Motif de rejet obligatoire');
    }
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new NotFoundException('Acteur introuvable');
    const isHr = ([UserRole.ADMIN, UserRole.RH, UserRole.DG] as UserRole[]).includes(actor.role);
    const isManager = leave.user.employeeProfile?.managerId === actorId;
    if (!isHr && !isManager) throw new BadRequestException('Validation reservee au responsable ou au RH');

    const rhNeeded = ([
      LeaveType.MALADIE,
      LeaveType.MATERNITE,
      LeaveType.PATERNITE,
      LeaveType.SANS_SOLDE,
      LeaveType.ABSENCE_INJUSTIFIEE,
    ] as LeaveType[]).includes(leave.type);

    let status: LeaveStatus = leave.status;
    let managerId = leave.managerId;
    let managerAt = leave.managerAt;
    let validatedById = leave.validatedById;
    let validatedAt = leave.validatedAt;

    if (!approve) {
      status = LeaveStatus.REJETEE;
      validatedById = actorId;
      validatedAt = new Date();
    } else if (isManager && leave.status === LeaveStatus.SOUMISE) {
      managerId = actorId;
      managerAt = new Date();
      status = rhNeeded ? LeaveStatus.VALIDEE_MANAGER : LeaveStatus.VALIDEE;
      if (!rhNeeded) {
        validatedById = actorId;
        validatedAt = new Date();
      }
    } else if (isHr) {
      status = LeaveStatus.VALIDEE;
      validatedById = actorId;
      validatedAt = new Date();
    } else {
      throw new BadRequestException('Cette etape de validation ne vous est pas ouverte');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        managerId,
        managerAt,
        validatedById,
        validatedAt,
        rejectionReason: approve ? null : reason,
      },
      include: {
        user: { select: USER_SELECT },
        validatedBy: { select: { firstName: true, lastName: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    });
    await this.notifications.create({
      userId: leave.userId,
      title: approve ? 'Conge valide' : 'Conge rejete',
      message: approve
        ? 'Votre demande de conge a ete traitee favorablement.'
        : `Votre demande de conge a ete rejetee : ${reason}`,
      type: approve ? NotificationType.SUCCESS : NotificationType.WARNING,
      category: NotificationCategory.RH,
      link: '/hr',
    });
    return updated;
  }

  async cancelLeave(id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Demande introuvable');
    if (leave.status === LeaveStatus.ANNULEE) throw new BadRequestException('Déjà annulée');
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.ANNULEE },
      include: { user: { select: USER_SELECT } },
    });
    await this.notifications.create({
      userId: leave.userId,
      title: 'Conge annule',
      message: `Votre demande de conge ${leave.type} a ete annulee.`,
      type: NotificationType.WARNING,
      category: NotificationCategory.RH,
      link: '/hr',
    });
    return updated;
  }

  listPeriods() {
    return this.prisma.payrollPeriod.findMany({
      include: {
        validatedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async createPeriod(body: { year: number; month: number; expectedDays?: number; notes?: string }) {
    if (body.month < 1 || body.month > 12) throw new BadRequestException('Mois invalide');
    const existing = await this.prisma.payrollPeriod.findUnique({
      where: { year_month: { year: body.year, month: body.month } },
    });
    if (existing) throw new BadRequestException('Une période existe déjà pour ce mois');
    return this.prisma.payrollPeriod.create({
      data: {
        year: body.year,
        month: body.month,
        expectedDays: body.expectedDays ?? 26,
        notes: body.notes,
      },
    });
  }

  async computePeriod(id: string) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Période introuvable');
    if (period.status === PayrollPeriodStatus.CLOTUREE) {
      throw new BadRequestException('Période clôturée');
    }
    const employees = await this.prisma.employeeProfile.findMany({
      where: { status: EmployeeStatus.ACTIF },
      include: { user: { select: USER_SELECT } },
    });
    const monthStart = new Date(Date.UTC(period.year, period.month - 1, 1));
    const monthEnd = new Date(Date.UTC(period.year, period.month, 0));
    const unpaidLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.VALIDEE,
        type: { in: [LeaveType.SANS_SOLDE, LeaveType.MALADIE] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });

    await this.prisma.payslip.deleteMany({
      where: { periodId: id, status: { not: PayslipStatus.PAYEE } },
    });

    for (const employee of employees) {
      const unpaidDays = unpaidLeaves
        .filter((leave) => leave.userId === employee.userId)
        .reduce((sum, leave) => {
          const from = leave.startDate > monthStart ? leave.startDate : monthStart;
          const to = leave.endDate < monthEnd ? leave.endDate : monthEnd;
          return sum + daysInclusive(from, to);
        }, 0);
      const workedDays = Math.max(0, period.expectedDays - unpaidDays);
      const prorata = period.expectedDays > 0 ? workedDays / period.expectedDays : 0;
      const base = new Prisma.Decimal(employee.baseSalary);
      const gross = roundMoney(base.mul(prorata));
      const cnss = roundMoney(gross.mul(CNSS_RATE));
      const taxable = Number(gross) - IPRF_THRESHOLD;
      const iprf = roundMoney(taxable > 0 ? taxable * IPRF_RATE : 0);
      const net = roundMoney(gross.sub(cnss).sub(iprf));

      await this.prisma.payslip.upsert({
        where: { periodId_userId: { periodId: id, userId: employee.userId } },
        update: {
          employeeProfileId: employee.id,
          baseSalary: employee.baseSalary,
          workedDays,
          overtimeHours: 0,
          overtimeAmount: 0,
          bonuses: 0,
          deductions: 0,
          cnssEmployee: cnss,
          iprf,
          grossPay: gross,
          netPay: net,
          status: PayslipStatus.BROUILLON,
        },
        create: {
          periodId: id,
          userId: employee.userId,
          employeeProfileId: employee.id,
          baseSalary: employee.baseSalary,
          workedDays,
          cnssEmployee: cnss,
          iprf,
          grossPay: gross,
          netPay: net,
        },
      });
    }

    return this.prisma.payrollPeriod.update({
      where: { id },
      data: { status: PayrollPeriodStatus.CALCULEE, generatedAt: new Date() },
      include: {
        payslips: { include: { user: { select: USER_SELECT }, employee: true } },
        _count: { select: { payslips: true } },
      },
    });
  }

  listPayslips(periodId: string) {
    return this.prisma.payslip.findMany({
      where: { periodId },
      include: { user: { select: USER_SELECT }, employee: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updatePayslip(
    id: string,
    body: Partial<{ overtimeHours: number; bonuses: number; deductions: number }>,
  ) {
    const slip = await this.prisma.payslip.findUnique({ where: { id } });
    if (!slip) throw new NotFoundException('Bulletin introuvable');
    if (slip.status === PayslipStatus.PAYEE) throw new BadRequestException('Bulletin déjà payé');
    const overtimeHours = body.overtimeHours ?? Number(slip.overtimeHours);
    const bonuses = body.bonuses ?? Number(slip.bonuses);
    const deductions = body.deductions ?? Number(slip.deductions);
    const daily = Number(slip.baseSalary) / 26 / 8;
    const overtimeAmount = roundMoney(overtimeHours * daily * OVERTIME_RATE);
    const gross = roundMoney(Number(slip.baseSalary) * (slip.workedDays / 26) + Number(overtimeAmount) + bonuses);
    const cnss = roundMoney(Number(gross) * CNSS_RATE);
    const taxable = Number(gross) - IPRF_THRESHOLD;
    const iprf = roundMoney(taxable > 0 ? taxable * IPRF_RATE : 0);
    const net = roundMoney(Number(gross) - deductions - Number(cnss) - Number(iprf));
    return this.prisma.payslip.update({
      where: { id },
      data: {
        overtimeHours,
        overtimeAmount,
        bonuses,
        deductions,
        cnssEmployee: cnss,
        iprf,
        grossPay: gross,
        netPay: net,
        status: PayslipStatus.BROUILLON,
      },
      include: { user: { select: USER_SELECT }, employee: true },
    });
  }

  async validatePayslip(id: string) {
    const slip = await this.prisma.payslip.findUnique({ where: { id } });
    if (!slip) throw new NotFoundException('Bulletin introuvable');
    const updated = await this.prisma.payslip.update({
      where: { id },
      data: { status: PayslipStatus.VALIDEE },
      include: { user: { select: USER_SELECT }, employee: true },
    });
    await this.notifications.create({
      userId: slip.userId,
      title: 'Bulletin valide',
      message: `Votre bulletin de paie a ete valide.`,
      type: NotificationType.SUCCESS,
      category: NotificationCategory.RH,
      link: '/hr',
    });
    return updated;
  }

  async payPayslip(id: string, paymentReference?: string) {
    const slip = await this.prisma.payslip.findUnique({ where: { id } });
    if (!slip) throw new NotFoundException('Bulletin introuvable');
    if (slip.status === PayslipStatus.BROUILLON) {
      throw new BadRequestException('Validez le bulletin avant de le payer');
    }
    return this.prisma.payslip.update({
      where: { id },
      data: {
        status: PayslipStatus.PAYEE,
        paidAt: new Date(),
        paymentReference: paymentReference || `PAIE-${slip.id.slice(0, 8).toUpperCase()}`,
      },
      include: { user: { select: USER_SELECT }, employee: true },
    });
  }

  async validatePeriod(id: string, actorId: string) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: { payslips: true },
    });
    if (!period) throw new NotFoundException('Période introuvable');
    if (period.status !== PayrollPeriodStatus.CALCULEE) {
      throw new BadRequestException('Calculez la paie avant de valider');
    }
    await this.prisma.payslip.updateMany({
      where: { periodId: id, status: PayslipStatus.BROUILLON },
      data: { status: PayslipStatus.VALIDEE },
    });
    return this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: PayrollPeriodStatus.VALIDEE,
        validatedAt: new Date(),
        validatedById: actorId,
      },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async closePeriod(id: string) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Période introuvable');
    if (period.status !== PayrollPeriodStatus.VALIDEE) {
      throw new BadRequestException('Validez la période avant de la clôturer');
    }
    await this.prisma.payslip.updateMany({
      where: { periodId: id, status: PayslipStatus.VALIDEE },
      data: { status: PayslipStatus.PAYEE, paidAt: new Date() },
    });
    return this.prisma.payrollPeriod.update({
      where: { id },
      data: { status: PayrollPeriodStatus.CLOTUREE, closedAt: new Date() },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async deletePeriod(id: string) {
    const period = await this.prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Période introuvable');
    if (period.status === PayrollPeriodStatus.CLOTUREE) {
      throw new BadRequestException('Impossible de supprimer une période clôturée');
    }
    await this.prisma.payslip.deleteMany({ where: { periodId: id } });
    return this.prisma.payrollPeriod.delete({ where: { id } });
  }

  async getActivityReport(userId: string, date: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Agent introuvable');
    const { start, end, day } = this.dayRange(date);
    const [deliveries, tours, payments, shifts, report] = await Promise.all([
      this.prisma.delivery.findMany({
        where: {
          driverId: userId,
          OR: [{ createdAt: { gte: start, lt: end } }, { deliveredAt: { gte: start, lt: end } }],
        },
        include: {
          client: { select: { name: true, code: true } },
          lines: { select: { qtyDelivered: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.tour.findMany({
        where: { driverId: userId, date: day },
        select: { id: true, tourNumber: true, zone: true, status: true },
      }),
      this.prisma.payment.findMany({
        where: { collectedBy: userId, createdAt: { gte: start, lt: end } },
        select: { id: true, paymentNumber: true, amount: true, method: true },
      }),
      this.prisma.shiftAssignment.findMany({
        where: { userId, date: day },
      }),
      this.prisma.dailyActivityReport.findUnique({
        where: { userId_date: { userId, date: day } },
      }),
    ]);
    const qtyDelivered = deliveries.reduce(
      (sum, d) => sum + d.lines.reduce((lineSum, line) => lineSum + line.qtyDelivered, 0),
      0,
    );
    const metrics = {
      deliveries: deliveries.length,
      delivered: deliveries.filter((d) => d.status === DeliveryStatus.LIVREE).length,
      refused: deliveries.filter((d) => d.status === DeliveryStatus.REFUSEE).length,
      qtyDelivered,
      tours: tours.length,
      paymentsCount: payments.length,
      paymentsAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      shifts: shifts.length,
    };
    const activities = (report?.activities ?? {}) as Record<string, unknown>;
    return {
      user,
      date,
      metrics,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        deliveryNumber: d.deliveryNumber,
        status: d.status,
        clientName: d.client?.name,
        qtyDelivered: d.lines.reduce((s, l) => s + l.qtyDelivered, 0),
      })),
      tours,
      payments: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amount: Number(p.amount),
        method: p.method,
      })),
      shifts,
      report,
      summary: typeof activities.summary === 'string' ? activities.summary : '',
      incidents: report?.incidents ?? '',
    };
  }

  async upsertActivityReport(userId: string, body: { date: string; summary?: string; incidents?: string }) {
    if (!body.date) throw new BadRequestException('Date obligatoire');
    const snapshot = await this.getActivityReport(userId, body.date);
    const day = this.dayRange(body.date).day;
    const activities: Prisma.InputJsonValue = {
      summary: body.summary?.trim() || '',
      metrics: snapshot.metrics,
    };
    return this.prisma.dailyActivityReport.upsert({
      where: { userId_date: { userId, date: day } },
      create: {
        userId,
        date: day,
        activities,
        incidents: body.incidents?.trim() || null,
      },
      update: {
        activities,
        incidents: body.incidents?.trim() || null,
        validated: false,
      },
    });
  }

  async activityOverview(date: string) {
    const { start, end, day } = this.dayRange(date);
    const [users, reports, deliveryGroups, tourGroups, paymentGroups, shiftGroups] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true },
        select: USER_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.dailyActivityReport.findMany({ where: { date: day } }),
      this.prisma.delivery.groupBy({
        by: ['driverId', 'status'],
        where: { createdAt: { gte: start, lt: end } },
        _count: { _all: true },
      }),
      this.prisma.tour.groupBy({
        by: ['driverId'],
        where: { date: day },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['collectedBy'],
        where: { createdAt: { gte: start, lt: end } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.shiftAssignment.groupBy({
        by: ['userId'],
        where: { date: day },
        _count: { _all: true },
      }),
    ]);

    const reportByUser = new Map(reports.map((r) => [r.userId, r]));
    const toursByUser = new Map(tourGroups.map((g) => [g.driverId, g._count._all]));
    const shiftsByUser = new Map(shiftGroups.map((g) => [g.userId, g._count._all]));
    const paymentsByUser = new Map(
      paymentGroups.map((g) => [
        g.collectedBy,
        { count: g._count._all, amount: Number(g._sum.amount ?? 0) },
      ]),
    );
    const deliveriesByUser = new Map<string, { total: number; delivered: number; refused: number }>();
    for (const g of deliveryGroups) {
      const current = deliveriesByUser.get(g.driverId) ?? { total: 0, delivered: 0, refused: 0 };
      current.total += g._count._all;
      if (g.status === DeliveryStatus.LIVREE) current.delivered += g._count._all;
      if (g.status === DeliveryStatus.REFUSEE) current.refused += g._count._all;
      deliveriesByUser.set(g.driverId, current);
    }

    const rows = users.map((user) => {
      const deliveries = deliveriesByUser.get(user.id) ?? { total: 0, delivered: 0, refused: 0 };
      const payments = paymentsByUser.get(user.id) ?? { count: 0, amount: 0 };
      const report = reportByUser.get(user.id) ?? null;
      return {
        user,
        deliveries: deliveries.total,
        delivered: deliveries.delivered,
        refused: deliveries.refused,
        tours: toursByUser.get(user.id) ?? 0,
        shifts: shiftsByUser.get(user.id) ?? 0,
        paymentsCount: payments.count,
        paymentsAmount: payments.amount,
        submitted: Boolean(report),
        validated: report?.validated ?? false,
        incidents: report?.incidents ?? '',
        reportId: report?.id ?? null,
      };
    });

    return {
      date,
      totals: {
        agents: rows.length,
        submitted: rows.filter((r) => r.submitted).length,
        validated: rows.filter((r) => r.validated).length,
        deliveries: rows.reduce((s, r) => s + r.deliveries, 0),
        tours: rows.reduce((s, r) => s + r.tours, 0),
        paymentsAmount: rows.reduce((s, r) => s + r.paymentsAmount, 0),
      },
      rows,
    };
  }

  async validateActivityReport(id: string) {
    const report = await this.prisma.dailyActivityReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Rapport introuvable');
    return this.prisma.dailyActivityReport.update({
      where: { id },
      data: { validated: true },
    });
  }

  private dayRange(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Date invalide');
    }
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end, day: start };
  }
}
