import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FinanceAccountKind,
  FinanceCategoryKind,
  FinanceInventoryStatus,
  FinanceMovementKind,
  FinanceMovementStatus,
  NotificationCategory,
  NotificationType,
  PaymentMethod,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateFinanceAccountDto,
  CreateFinanceBudgetDto,
  CreateFinanceCategoryDto,
  CreateFinanceInventoryDto,
  CreateFinanceMovementDto,
  UpdateFinanceAccountDto,
  UpdateFinanceBudgetDto,
} from './dto/finance.dto';

const USER = { select: { id: true, firstName: true, lastName: true } } as const;
const CASH_METHODS: PaymentMethod[] = [
  PaymentMethod.ESPECES,
  PaymentMethod.MOBILE_MONEY,
  PaymentMethod.MPESA,
  PaymentMethod.ORANGE_MONEY,
  PaymentMethod.AIRTEL_MONEY,
  PaymentMethod.WAVE,
];

const DEFAULT_ACCOUNTS: Array<{ code: string; name: string; kind: FinanceAccountKind }> = [
  { code: 'CAI-01', name: 'Caisse principale', kind: FinanceAccountKind.CAISSE },
  { code: 'BQ-01', name: 'Compte Rawbank', kind: FinanceAccountKind.BANQUE },
];

const DEFAULT_CATEGORIES: Array<{ code: string; name: string; kind: FinanceCategoryKind }> = [
  { code: 'REC-VTE', name: 'Ventes eau', kind: FinanceCategoryKind.RECETTE },
  { code: 'REC-AUT', name: 'Autres recettes', kind: FinanceCategoryKind.RECETTE },
  { code: 'CHG-ACH', name: 'Achats et stocks', kind: FinanceCategoryKind.CHARGE },
  { code: 'CHG-CAR', name: 'Carburant', kind: FinanceCategoryKind.CHARGE },
  { code: 'CHG-SAL', name: 'Salaires et charges', kind: FinanceCategoryKind.CHARGE },
  { code: 'CHG-LOY', name: 'Loyer et charges locatives', kind: FinanceCategoryKind.CHARGE },
  { code: 'CHG-ENT', name: 'Entretien et maintenance', kind: FinanceCategoryKind.CHARGE },
  { code: 'CHG-TAX', name: 'Taxes et formalites', kind: FinanceCategoryKind.CHARGE },
  { code: 'TRF-INT', name: 'Transfert interne', kind: FinanceCategoryKind.TRANSFERT },
];

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async summary() {
    await this.ensureDefaults();
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [accounts, movements, budgets, stock] = await Promise.all([
      this.listAccounts(),
      this.prisma.financeMovement.findMany({
        where: { status: FinanceMovementStatus.VALIDE, date: { gte: from, lt: to } },
        select: { kind: true, amount: true, method: true, categoryId: true },
      }),
      this.listBudgets({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      this.inventorySnapshot(),
    ]);
    const cashBalance = accounts.filter((a) => a.kind === 'CAISSE').reduce((s, a) => s + a.balance, 0);
    const bankBalance = accounts.filter((a) => a.kind === 'BANQUE').reduce((s, a) => s + a.balance, 0);
    const cashInHand = accounts
      .filter((a) => a.kind === 'CAISSE')
      .reduce((s, a) => s + a.balance, 0);
    let monthIn = 0;
    let monthOut = 0;
    let monthExpenses = 0;
    let monthCash = 0;
    let monthBank = 0;
    for (const row of movements) {
      const amount = Number(row.amount);
      if (row.kind === FinanceMovementKind.ENTREE || row.kind === FinanceMovementKind.ENCAISSEMENT) {
        monthIn += amount;
        if (CASH_METHODS.includes(row.method)) monthCash += amount;
        else monthBank += amount;
      } else if (row.kind === FinanceMovementKind.SORTIE || row.kind === FinanceMovementKind.DEPENSE) {
        monthOut += amount;
        if (row.kind === FinanceMovementKind.DEPENSE) monthExpenses += amount;
      }
    }
    return {
      cashBalance,
      bankBalance,
      cashInHand,
      totalTreasury: cashBalance + bankBalance,
      monthIn,
      monthOut,
      monthExpenses,
      monthCash,
      monthBank,
      netMonth: monthIn - monthOut,
      inventoryValue: stock.totalValue,
      inventorySku: stock.lines.length,
      accounts,
      budgets,
    };
  }

  async listAccounts() {
    await this.ensureDefaults();
    const rows = await this.prisma.financeAccount.findMany({
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
      include: { createdBy: USER },
    });
    const balances = await this.balancesByAccount();
    return rows.map((row) => ({
      ...row,
      openingBalance: Number(row.openingBalance),
      balance: balances.get(row.id) ?? Number(row.openingBalance),
    }));
  }

  async createAccount(dto: CreateFinanceAccountDto, userId: string) {
    const created = await this.prisma.financeAccount.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        kind: dto.kind,
        currency: dto.currency?.trim() || 'CDF',
        openingBalance: dto.openingBalance ?? 0,
        bankName: dto.bankName?.trim() || null,
        iban: dto.iban?.trim() || null,
        createdById: userId,
      },
      include: { createdBy: USER },
    });
    await this.notify('Nouveau compte tresorerie', `${created.code} — ${created.name}`);
    return { ...created, openingBalance: Number(created.openingBalance), balance: Number(created.openingBalance) };
  }

  async updateAccount(id: string, dto: UpdateFinanceAccountDto) {
    await this.findAccount(id);
    const updated = await this.prisma.financeAccount.update({
      where: { id },
      data: {
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        kind: dto.kind,
        currency: dto.currency?.trim(),
        openingBalance: dto.openingBalance,
        bankName: dto.bankName === undefined ? undefined : dto.bankName.trim() || null,
        iban: dto.iban === undefined ? undefined : dto.iban.trim() || null,
        isActive: dto.isActive,
      },
    });
    return updated;
  }

  async listCategories() {
    await this.ensureDefaults();
    return this.prisma.financeCategory.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  }

  createCategory(dto: CreateFinanceCategoryDto) {
    return this.prisma.financeCategory.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        kind: dto.kind,
      },
    });
  }

  async listMovements(query?: { kind?: string; status?: string; accountId?: string; from?: string; to?: string }) {
    await this.ensureDefaults();
    return this.prisma.financeMovement.findMany({
      where: {
        kind: query?.kind as FinanceMovementKind | undefined,
        status: query?.status as FinanceMovementStatus | undefined,
        accountId: query?.accountId,
        date: {
          gte: query?.from ? new Date(query.from) : undefined,
          lte: query?.to ? new Date(query.to) : undefined,
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, kind: true } },
        destAccount: { select: { id: true, code: true, name: true, kind: true } },
        category: { select: { id: true, code: true, name: true, kind: true } },
        createdBy: USER,
        validatedBy: USER,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 400,
    });
  }

  async createMovement(dto: CreateFinanceMovementDto, userId: string) {
    await this.assertMovement(dto);
    const created = await this.prisma.financeMovement.create({
      data: {
        number: await this.nextNumber('FIN'),
        kind: dto.kind,
        accountId: dto.accountId,
        destAccountId: dto.kind === 'TRANSFERT' ? dto.destAccountId : null,
        categoryId: dto.categoryId,
        amount: dto.amount,
        method: dto.method ?? PaymentMethod.ESPECES,
        date: new Date(dto.date),
        label: dto.label.trim(),
        reference: dto.reference?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: userId,
      },
      include: {
        account: { select: { code: true, name: true } },
        destAccount: { select: { code: true, name: true } },
        category: { select: { name: true } },
      },
    });
    await this.notify(
      dto.kind === 'DEPENSE' ? 'Depense enregistree' : 'Mouvement de fonds',
      `${created.number} — ${created.label} : ${created.amount}`,
    );
    return created;
  }

  async validateMovement(id: string, userId: string) {
    const row = await this.prisma.financeMovement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Mouvement introuvable');
    if (row.status !== FinanceMovementStatus.BROUILLON) {
      throw new BadRequestException('Seul un brouillon peut etre valide');
    }
    const updated = await this.prisma.financeMovement.update({
      where: { id },
      data: { status: FinanceMovementStatus.VALIDE, validatedById: userId, validatedAt: new Date() },
      include: { account: { select: { code: true, name: true } } },
    });
    await this.notify('Mouvement valide', `${updated.number} — ${updated.label}`);
    return updated;
  }

  async cancelMovement(id: string) {
    const row = await this.prisma.financeMovement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Mouvement introuvable');
    if (row.status === FinanceMovementStatus.ANNULE) {
      throw new BadRequestException('Mouvement deja annule');
    }
    return this.prisma.financeMovement.update({
      where: { id },
      data: { status: FinanceMovementStatus.ANNULE },
    });
  }

  async postFromPayment(input: {
    paymentId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string | null;
    label: string;
    collectedBy: string;
    date?: Date;
  }) {
    await this.ensureDefaults();
    const existing = await this.prisma.financeMovement.findUnique({ where: { paymentId: input.paymentId } });
    if (existing) return existing;
    const kind = CASH_METHODS.includes(input.method) ? FinanceAccountKind.CAISSE : FinanceAccountKind.BANQUE;
    const account = await this.prisma.financeAccount.findFirst({
      where: { kind, isActive: true },
      orderBy: { code: 'asc' },
    });
    const category = await this.prisma.financeCategory.findFirst({
      where: { kind: FinanceCategoryKind.RECETTE, isActive: true },
      orderBy: { code: 'asc' },
    });
    if (!account) return null;
    return this.prisma.financeMovement.create({
      data: {
        number: await this.nextNumber('FIN'),
        kind: FinanceMovementKind.ENCAISSEMENT,
        status: FinanceMovementStatus.VALIDE,
        accountId: account.id,
        categoryId: category?.id,
        paymentId: input.paymentId,
        amount: input.amount,
        method: input.method,
        date: input.date ?? new Date(),
        label: input.label,
        reference: input.reference ?? null,
        createdById: input.collectedBy,
        validatedById: input.collectedBy,
        validatedAt: new Date(),
      },
    });
  }

  async listBudgets(query?: { year?: number; month?: number }) {
    await this.ensureDefaults();
    const year = query?.year ?? new Date().getFullYear();
    const rows = await this.prisma.financeBudget.findMany({
      where: {
        year,
        OR: query?.month ? [{ month: query.month }, { month: null }] : undefined,
      },
      include: { category: true },
      orderBy: [{ month: 'asc' }, { category: { name: 'asc' } }],
    });
    const from = new Date(Date.UTC(year, query?.month ? query.month - 1 : 0, 1));
    const to = new Date(Date.UTC(year, query?.month ? query.month : 12, 1));
    const actuals = await this.prisma.financeMovement.groupBy({
      by: ['categoryId'],
      where: {
        status: FinanceMovementStatus.VALIDE,
        categoryId: { not: null },
        date: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });
    const map = new Map(actuals.map((a) => [a.categoryId, Number(a._sum.amount ?? 0)]));
    return rows.map((row) => {
      const planned = Number(row.plannedAmount);
      const actual = map.get(row.categoryId) ?? 0;
      return {
        ...row,
        plannedAmount: planned,
        actualAmount: actual,
        remaining: planned - actual,
        progressPct: planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0,
      };
    });
  }

  async createBudget(dto: CreateFinanceBudgetDto) {
    const category = await this.prisma.financeCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Rubrique introuvable');
    return this.prisma.financeBudget.create({
      data: {
        year: dto.year,
        month: dto.month ?? null,
        categoryId: dto.categoryId,
        plannedAmount: dto.plannedAmount,
        notes: dto.notes?.trim() || null,
      },
      include: { category: true },
    });
  }

  async updateBudget(id: string, dto: UpdateFinanceBudgetDto) {
    const current = await this.prisma.financeBudget.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Budget introuvable');
    return this.prisma.financeBudget.update({
      where: { id },
      data: {
        year: dto.year,
        month: dto.month === undefined ? undefined : dto.month,
        categoryId: dto.categoryId,
        plannedAmount: dto.plannedAmount,
        notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
      },
      include: { category: true },
    });
  }

  async removeBudget(id: string) {
    await this.prisma.financeBudget.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Budget introuvable');
    });
    return { id };
  }

  async inventorySnapshot() {
    const items = await this.prisma.stockItem.findMany({
      include: {
        product: { select: { id: true, code: true, name: true, unitPrice: true, format: true } },
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ location: { code: 'asc' } }, { product: { name: 'asc' } }],
    });
    const lines = items.map((item) => {
      const unitValue = Number(item.product.unitPrice);
      return {
        productId: item.productId,
        locationId: item.locationId,
        productCode: item.product.code,
        productName: item.product.name,
        locationCode: item.location.code,
        locationName: item.location.name,
        theoreticalQty: item.quantity,
        unitValue,
        theoreticalValue: item.quantity * unitValue,
      };
    });
    return {
      lines,
      totalQty: lines.reduce((s, l) => s + l.theoreticalQty, 0),
      totalValue: lines.reduce((s, l) => s + l.theoreticalValue, 0),
    };
  }

  listInventories() {
    return this.prisma.financeInventory.findMany({
      include: {
        createdBy: USER,
        validatedBy: USER,
        lines: { include: { product: { select: { code: true, name: true } } } },
        _count: { select: { lines: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
  }

  async createInventory(dto: CreateFinanceInventoryDto, userId: string) {
    if (!dto.lines.length) throw new BadRequestException('Ajoutez au moins une ligne d\'inventaire');
    const created = await this.prisma.financeInventory.create({
      data: {
        number: await this.nextNumber('INV'),
        date: new Date(dto.date),
        notes: dto.notes?.trim() || null,
        createdById: userId,
        lines: {
          create: dto.lines.map((line) => ({
            productId: line.productId,
            locationId: line.locationId,
            theoreticalQty: line.theoreticalQty,
            countedQty: line.countedQty,
            unitValue: line.unitValue,
          })),
        },
      },
      include: { lines: { include: { product: { select: { code: true, name: true } } } }, createdBy: USER },
    });
    await this.notify('Inventaire ouvert', created.number);
    return created;
  }

  async validateInventory(id: string, userId: string) {
    const row = await this.prisma.financeInventory.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!row) throw new NotFoundException('Inventaire introuvable');
    if (row.status !== FinanceInventoryStatus.BROUILLON) {
      throw new BadRequestException('Seul un inventaire brouillon peut etre valide');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const line of row.lines) {
        const item = await tx.stockItem.findFirst({
          where: { productId: line.productId, locationId: line.locationId },
        });
        if (item) {
          await tx.stockItem.update({ where: { id: item.id }, data: { quantity: line.countedQty } });
        }
      }
      await tx.financeInventory.update({
        where: { id },
        data: { status: FinanceInventoryStatus.VALIDE, validatedById: userId, validatedAt: new Date() },
      });
    });
    await this.notify('Inventaire valide', row.number);
    return this.prisma.financeInventory.findUnique({
      where: { id },
      include: { lines: { include: { product: { select: { code: true, name: true } } } }, createdBy: USER, validatedBy: USER },
    });
  }

  private async balancesByAccount() {
    const accounts = await this.prisma.financeAccount.findMany();
    const movements = await this.prisma.financeMovement.findMany({
      where: { status: FinanceMovementStatus.VALIDE },
      select: { kind: true, accountId: true, destAccountId: true, amount: true },
    });
    const map = new Map(accounts.map((a) => [a.id, Number(a.openingBalance)]));
    for (const row of movements) {
      const amount = Number(row.amount);
      if (row.kind === FinanceMovementKind.ENTREE || row.kind === FinanceMovementKind.ENCAISSEMENT) {
        map.set(row.accountId, (map.get(row.accountId) ?? 0) + amount);
      } else if (row.kind === FinanceMovementKind.SORTIE || row.kind === FinanceMovementKind.DEPENSE) {
        map.set(row.accountId, (map.get(row.accountId) ?? 0) - amount);
      } else if (row.kind === FinanceMovementKind.TRANSFERT && row.destAccountId) {
        map.set(row.accountId, (map.get(row.accountId) ?? 0) - amount);
        map.set(row.destAccountId, (map.get(row.destAccountId) ?? 0) + amount);
      }
    }
    return map;
  }

  private async findAccount(id: string) {
    const row = await this.prisma.financeAccount.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Compte introuvable');
    return row;
  }

  private async assertMovement(dto: CreateFinanceMovementDto) {
    if (dto.amount <= 0) throw new BadRequestException('Le montant doit etre positif');
    await this.findAccount(dto.accountId);
    if (dto.kind === 'TRANSFERT') {
      if (!dto.destAccountId) throw new BadRequestException('Le compte destination est requis');
      if (dto.destAccountId === dto.accountId) throw new BadRequestException('Les deux comptes doivent etre distincts');
      await this.findAccount(dto.destAccountId);
    }
  }

  private async nextNumber(prefix: string) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count =
      prefix === 'INV'
        ? await this.prisma.financeInventory.count()
        : await this.prisma.financeMovement.count();
    return `${prefix}-${stamp}-${String(count + 1).padStart(4, '0')}`;
  }

  private async notify(title: string, message: string) {
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMPTABLE, UserRole.CAISSIER, UserRole.DG],
      {
        title,
        message,
        type: NotificationType.INFO,
        category: NotificationCategory.COMPTABILITE,
        link: '/finance',
      },
    );
  }

  private async ensureDefaults() {
    const [accounts, categories] = await Promise.all([
      this.prisma.financeAccount.count(),
      this.prisma.financeCategory.count(),
    ]);
    if (accounts === 0) {
      await this.prisma.financeAccount.createMany({ data: DEFAULT_ACCOUNTS });
    }
    if (categories === 0) {
      await this.prisma.financeCategory.createMany({ data: DEFAULT_CATEGORIES });
    }
  }
}
