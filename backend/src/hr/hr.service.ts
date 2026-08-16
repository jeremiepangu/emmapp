import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractType,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  PayrollPeriodStatus,
  PayslipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

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
  constructor(private prisma: PrismaService) {}

  listEmployees() {
    return this.prisma.employeeProfile.findMany({
      include: { user: { select: USER_SELECT } },
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
    }>,
  ) {
    const profile = await this.prisma.employeeProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Dossier RH introuvable');
    return this.prisma.employeeProfile.update({
      where: { id },
      data: {
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
      },
      include: { user: { select: USER_SELECT } },
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
    return this.prisma.leaveRequest.create({
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

  async decideLeave(id: string, approve: boolean, actorId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Demande introuvable');
    if (leave.status !== LeaveStatus.SOUMISE && leave.status !== LeaveStatus.BROUILLON) {
      throw new BadRequestException('Cette demande n’est plus en attente');
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: approve ? LeaveStatus.VALIDEE : LeaveStatus.REJETEE,
        validatedById: actorId,
        validatedAt: new Date(),
      },
      include: { user: { select: USER_SELECT }, validatedBy: { select: { firstName: true, lastName: true } } },
    });
  }

  async cancelLeave(id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Demande introuvable');
    if (leave.status === LeaveStatus.ANNULEE) throw new BadRequestException('Déjà annulée');
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.ANNULEE },
      include: { user: { select: USER_SELECT } },
    });
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
    return this.prisma.payslip.update({
      where: { id },
      data: { status: PayslipStatus.VALIDEE },
      include: { user: { select: USER_SELECT }, employee: true },
    });
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
}
