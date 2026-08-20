import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BusinessContractKind,
  ClientSegment,
  ContractLifecycle,
  ContractPartyKind,
  ContractType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import {
  CreateAmendmentDto,
  CreateContractDto,
  CreateSupplierDto,
  ContractQueryDto,
  RenewContractDto,
  TerminateContractDto,
  UpdateContractDto,
  UpdateSupplierDto,
} from './dto/contract.dto';

const KEY_CLIENT_SEGMENTS: ClientSegment[] = [
  ClientSegment.SUPERMARCHE,
  ClientSegment.ENTREPRISE,
  ClientSegment.HOTEL_RESTAURANT,
];

const HR_KINDS: BusinessContractKind[] = [
  BusinessContractKind.CDI,
  BusinessContractKind.CDD,
  BusinessContractKind.STAGE,
  BusinessContractKind.PRESTATION,
  BusinessContractKind.JOURNALIER,
];

const INCLUDE = {
  employee: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  },
  supplier: true,
  client: { select: { id: true, code: true, name: true, segment: true, phone: true, email: true, zone: true } },
  validatedBy: { select: { id: true, firstName: true, lastName: true } },
  amendments: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.ContractInclude;

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  private today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async markExpired() {
    await this.prisma.contract.updateMany({
      where: { status: ContractLifecycle.ACTIF, endDate: { lt: this.today() } },
      data: { status: ContractLifecycle.EXPIRE },
    });
  }

  private async nextReference(prefix: string) {
    const last = await this.prisma.contract.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });
    const n = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(n) ? n : 1).padStart(4, '0')}`;
  }

  private async assertParty(dto: {
    partyKind: ContractPartyKind;
    employeeId?: string;
    supplierId?: string;
    clientId?: string;
  }) {
    if (dto.partyKind === ContractPartyKind.AGENT) {
      if (!dto.employeeId) throw new BadRequestException('Sélectionnez un agent');
      const employee = await this.prisma.employeeProfile.findUnique({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException('Dossier agent introuvable');
      return;
    }
    if (dto.partyKind === ContractPartyKind.SUPPLIER) {
      if (!dto.supplierId) throw new BadRequestException('Sélectionnez un fournisseur');
      const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier) throw new NotFoundException('Fournisseur introuvable');
      return;
    }
    if (!dto.clientId) throw new BadRequestException('Sélectionnez un grand client');
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client introuvable');
    if (!KEY_CLIENT_SEGMENTS.includes(client.segment)) {
      throw new BadRequestException('Le contrat grand client concerne un supermarché, une entreprise ou un hôtel/restaurant');
    }
  }

  private async syncEmployee(employeeId: string | undefined, dto: { kind?: BusinessContractKind; endDate?: string | null; amount?: number }) {
    if (!employeeId || !dto.kind || !HR_KINDS.includes(dto.kind)) return;
    await this.prisma.employeeProfile.update({
      where: { id: employeeId },
      data: {
        contractType: dto.kind as unknown as ContractType,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
        baseSalary: dto.amount !== undefined ? dto.amount : undefined,
      },
    });
  }

  async summary() {
    await this.markExpired();
    const [byStatus, byParty, expiring] = await Promise.all([
      this.prisma.contract.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contract.groupBy({ by: ['partyKind'], _count: { _all: true } }),
      this.prisma.contract.count({
        where: {
          status: { in: [ContractLifecycle.ACTIF, ContractLifecycle.SUSPENDU] },
          endDate: { lte: new Date(this.today().getTime() + 30 * 86400000), gte: this.today() },
        },
      }),
    ]);
    const status: Record<string, number> = {};
    for (const row of byStatus) status[row.status] = row._count._all;
    const parties: Record<string, number> = {};
    for (const row of byParty) parties[row.partyKind] = row._count._all;
    return {
      total: Object.values(status).reduce((a, b) => a + b, 0),
      status,
      parties,
      expiring30d: expiring,
    };
  }

  async parties() {
    const [employees, suppliers, clients] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where: { status: 'ACTIF' },
        include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
        orderBy: { matricule: 'asc' },
      }),
      this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.client.findMany({
        where: { isActive: true, segment: { in: KEY_CLIENT_SEGMENTS } },
        select: { id: true, code: true, name: true, segment: true, phone: true, email: true, zone: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { employees, suppliers, clients };
  }

  listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category?.trim() || undefined,
        contactName: dto.contactName?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
        email: dto.email?.trim() || undefined,
        address: dto.address?.trim() || undefined,
        nif: dto.nif?.trim() || undefined,
        rccm: dto.rccm?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fournisseur introuvable');
    return this.prisma.supplier.update({
      where: { id },
      data: {
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        category: dto.category?.trim(),
        contactName: dto.contactName?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
        address: dto.address?.trim(),
        nif: dto.nif?.trim(),
        rccm: dto.rccm?.trim(),
        notes: dto.notes?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  async deactivateSupplier(id: string) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fournisseur introuvable');
    return this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }

  async findAll(query: ContractQueryDto) {
    await this.markExpired();
    const where: Prisma.ContractWhereInput = {};
    if (query.partyKind) where.partyKind = query.partyKind;
    if (query.status) where.status = query.status;
    if (query.expiringDays) {
      const until = new Date(this.today().getTime() + query.expiringDays * 86400000);
      where.status = { in: [ContractLifecycle.ACTIF, ContractLifecycle.SUSPENDU] };
      where.endDate = { gte: this.today(), lte: until };
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { employee: { user: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.contract.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id }, include: INCLUDE });
    if (!contract) throw new NotFoundException('Contrat introuvable');
    return contract;
  }

  async create(dto: CreateContractDto) {
    await this.assertParty(dto);
    const year = new Date().getFullYear();
    const reference = await this.nextReference(`CTR-${year}-`);
    const created = await this.prisma.contract.create({
      data: {
        reference,
        partyKind: dto.partyKind,
        title: dto.title.trim(),
        kind: dto.kind,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        noticeDays: dto.noticeDays ?? 30,
        autoRenew: dto.autoRenew ?? false,
        currency: dto.currency?.trim() || 'CDF',
        amount: dto.amount,
        paymentTerms: dto.paymentTerms?.trim() || undefined,
        billingCycle: dto.billingCycle?.trim() || undefined,
        volumeCommitment: dto.volumeCommitment?.trim() || undefined,
        territory: dto.territory?.trim() || undefined,
        exclusivity: dto.exclusivity ?? false,
        clauses: dto.clauses?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
        documentUrl: dto.documentUrl?.trim() || undefined,
        employeeId: dto.partyKind === ContractPartyKind.AGENT ? dto.employeeId : undefined,
        supplierId: dto.partyKind === ContractPartyKind.SUPPLIER ? dto.supplierId : undefined,
        clientId: dto.partyKind === ContractPartyKind.KEY_CLIENT ? dto.clientId : undefined,
        signedByParty: dto.signedByParty?.trim() || undefined,
        signedByCompany: dto.signedByCompany?.trim() || undefined,
      },
      include: INCLUDE,
    });
    await this.syncEmployee(created.employeeId ?? undefined, dto);
    return created;
  }

  async update(id: string, dto: UpdateContractDto) {
    const current = await this.findOne(id);
    if (current.status === ContractLifecycle.RESILIE) {
      throw new BadRequestException('Un contrat résilié ne peut plus être modifié');
    }
    const partyKind = current.partyKind;
    await this.assertParty({
      partyKind,
      employeeId: dto.employeeId ?? current.employeeId ?? undefined,
      supplierId: dto.supplierId ?? current.supplierId ?? undefined,
      clientId: dto.clientId ?? current.clientId ?? undefined,
    });
    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        kind: dto.kind,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
        noticeDays: dto.noticeDays,
        autoRenew: dto.autoRenew,
        currency: dto.currency?.trim(),
        amount: dto.amount,
        paymentTerms: dto.paymentTerms?.trim(),
        billingCycle: dto.billingCycle?.trim(),
        volumeCommitment: dto.volumeCommitment?.trim(),
        territory: dto.territory?.trim(),
        exclusivity: dto.exclusivity,
        clauses: dto.clauses?.trim(),
        notes: dto.notes?.trim(),
        documentUrl: dto.documentUrl?.trim(),
        employeeId: partyKind === ContractPartyKind.AGENT ? dto.employeeId : undefined,
        supplierId: partyKind === ContractPartyKind.SUPPLIER ? dto.supplierId : undefined,
        clientId: partyKind === ContractPartyKind.KEY_CLIENT ? dto.clientId : undefined,
        signedByParty: dto.signedByParty?.trim(),
        signedByCompany: dto.signedByCompany?.trim(),
      },
      include: INCLUDE,
    });
    await this.syncEmployee(updated.employeeId ?? undefined, dto);
    return updated;
  }

  async remove(id: string) {
    const current = await this.findOne(id);
    if (current.status !== ContractLifecycle.BROUILLON) {
      throw new BadRequestException('Seuls les brouillons peuvent être supprimés — résiliez un contrat actif');
    }
    await this.prisma.contract.delete({ where: { id } });
    return { id };
  }

  async validate(id: string, userId: string) {
    const current = await this.findOne(id);
    if (current.status !== ContractLifecycle.BROUILLON && current.status !== ContractLifecycle.RENOUVELE) {
      throw new BadRequestException('Seuls un brouillon ou un renouvellement peuvent être validés');
    }
    return this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractLifecycle.ACTIF,
        validatedById: userId,
        validatedAt: new Date(),
        signedAt: current.signedAt ?? new Date(),
      },
      include: INCLUDE,
    });
  }

  async suspend(id: string) {
    const current = await this.findOne(id);
    if (current.status !== ContractLifecycle.ACTIF) {
      throw new BadRequestException('Seul un contrat actif peut être suspendu');
    }
    return this.prisma.contract.update({
      where: { id },
      data: { status: ContractLifecycle.SUSPENDU },
      include: INCLUDE,
    });
  }

  async resume(id: string) {
    const current = await this.findOne(id);
    if (current.status !== ContractLifecycle.SUSPENDU) {
      throw new BadRequestException('Seul un contrat suspendu peut être repris');
    }
    return this.prisma.contract.update({
      where: { id },
      data: { status: ContractLifecycle.ACTIF },
      include: INCLUDE,
    });
  }

  async renew(id: string, dto: RenewContractDto) {
    const current = await this.findOne(id);
    const renewable: ContractLifecycle[] = [
      ContractLifecycle.ACTIF,
      ContractLifecycle.EXPIRE,
      ContractLifecycle.SUSPENDU,
    ];
    if (!renewable.includes(current.status)) {
      throw new BadRequestException('Ce contrat ne peut pas être renouvelé');
    }
    let endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (!endDate) {
      if (current.endDate && current.startDate) {
        const span = current.endDate.getTime() - current.startDate.getTime();
        endDate = new Date((current.endDate > this.today() ? current.endDate : this.today()).getTime() + Math.max(span, 86400000));
      } else {
        endDate = new Date(this.today());
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
    }
    return this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractLifecycle.ACTIF,
        endDate,
        renewalCount: { increment: 1 },
        terminatedAt: null,
        terminateReason: null,
      },
      include: INCLUDE,
    });
  }

  async terminate(id: string, dto: TerminateContractDto) {
    const current = await this.findOne(id);
    if (current.status === ContractLifecycle.RESILIE || current.status === ContractLifecycle.BROUILLON) {
      throw new BadRequestException('Ce contrat ne peut pas être résilié');
    }
    return this.prisma.contract.update({
      where: { id },
      data: {
        status: ContractLifecycle.RESILIE,
        terminatedAt: new Date(),
        terminateReason: dto.reason.trim(),
      },
      include: INCLUDE,
    });
  }

  async addAmendment(id: string, dto: CreateAmendmentDto) {
    const current = await this.findOne(id);
    if (current.status === ContractLifecycle.RESILIE || current.status === ContractLifecycle.BROUILLON) {
      throw new BadRequestException('Impossible d’ajouter un avenant sur ce statut');
    }
    const seq = current.amendments.length + 1;
    const amendment = await this.prisma.contractAmendment.create({
      data: {
        contractId: id,
        reference: `${current.reference}-AV${String(seq).padStart(2, '0')}`,
        reason: dto.reason.trim(),
        amount: dto.amount,
        startDate: dto.startDate ? new Date(dto.startDate) : this.today(),
        notes: dto.notes?.trim() || undefined,
      },
    });
    if (dto.amount !== undefined) {
      await this.prisma.contract.update({ where: { id }, data: { amount: dto.amount } });
    }
    return this.findOne(id).then((c) => ({ ...c, lastAmendment: amendment }));
  }
}
