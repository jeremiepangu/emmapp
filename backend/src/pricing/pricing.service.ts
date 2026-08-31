import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientSegment, NotificationCategory, NotificationType, Prisma, PricingRule, PricingRuleType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/pricing-rule.dto';

const RULE_INCLUDE = {
  product: { select: { id: true, code: true, name: true } },
  client: { select: { id: true, code: true, name: true } },
  driver: { select: { id: true, firstName: true, lastName: true } },
} as const;

export interface PricingContext {
  clientId?: string | null;
  segment?: ClientSegment | null;
  zone?: string | null;
  driverId?: string | null;
}

export interface PricedLine {
  unitPrice: Prisma.Decimal;
  /** Valeur des articles offerts. Informative : elle n'est pas deduite du total. */
  bonus: Prisma.Decimal;
  catalogPrice: Prisma.Decimal;
  bonusPct: number;
  ruleId: string | null;
  ruleName: string | null;
  type: PricingRuleType | null;
  stepQuantity: number;
  /** Articles offerts, livres en plus de la quantite facturee. */
  bonusQuantity: number;
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

function normZone(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

@Injectable()
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  findAll() {
    return this.prisma.pricingRule.findMany({
      include: RULE_INCLUDE,
      orderBy: [{ priority: 'desc' }, { minQuantity: 'asc' }, { name: 'asc' }],
    });
  }

  findActive() {
    return this.prisma.pricingRule.findMany({ where: { isActive: true } });
  }

  async findOne(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id }, include: RULE_INCLUDE });
    if (!rule) throw new NotFoundException('Regle tarifaire introuvable');
    return rule;
  }

  async create(dto: CreatePricingRuleDto) {
    this.assertRange(dto.minQuantity ?? 1, dto.maxQuantity);
    this.assertStep(dto.stepQuantity ?? 10);
    this.assertValue(dto.type, dto.value, dto.stepQuantity ?? 10);
    await this.assertRefs(dto.clientId, dto.driverId);
    const created = await this.prisma.pricingRule.create({
      data: this.toData(dto),
      include: RULE_INCLUDE,
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMMERCIAL],
      {
        title: 'Regle tarifaire',
        message: created.name,
        type: NotificationType.INFO,
        category: NotificationCategory.SYSTEME,
        link: '/pricing',
      },
    );
    return created;
  }

  async update(id: string, dto: UpdatePricingRuleDto) {
    const current = await this.findOne(id);
    const minQuantity = dto.minQuantity ?? current.minQuantity;
    const maxQuantity = dto.maxQuantity === undefined ? current.maxQuantity : dto.maxQuantity;
    const type = dto.type ?? current.type;
    const value = dto.value ?? Number(current.value);
    const stepQuantity = dto.stepQuantity ?? current.stepQuantity;
    this.assertRange(minQuantity, maxQuantity);
    this.assertStep(stepQuantity);
    this.assertValue(type, value, stepQuantity);
    await this.assertRefs(
      dto.clientId === undefined ? current.clientId : dto.clientId,
      dto.driverId === undefined ? current.driverId : dto.driverId,
    );
    return this.prisma.pricingRule.update({
      where: { id },
      data: {
        name: dto.name,
        segment: dto.segment === undefined ? undefined : dto.segment || null,
        clientId: dto.clientId === undefined ? undefined : dto.clientId || null,
        zone: dto.zone === undefined ? undefined : emptyToNull(dto.zone),
        driverId: dto.driverId === undefined ? undefined : dto.driverId || null,
        productId: dto.productId === undefined ? undefined : dto.productId || null,
        minQuantity: dto.minQuantity,
        maxQuantity: dto.maxQuantity === undefined ? undefined : dto.maxQuantity,
        stepQuantity: dto.stepQuantity,
        type: dto.type,
        value: dto.value,
        priority: dto.priority,
        isActive: dto.isActive,
      },
      include: RULE_INCLUDE,
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.pricingRule.update({
      where: { id },
      data: { isActive: false },
      include: RULE_INCLUDE,
    });
  }

  async preview(clientId: string, productId: string, quantity: number, driverId?: string) {
    if (!clientId || !productId) throw new BadRequestException('clientId et productId sont requis');
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client introuvable');
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produit introuvable');
    const priced = await this.priceLine(this.ctxFromClient(client, driverId), product, quantity);
    return {
      segment: client.segment,
      zone: client.zone,
      quantity,
      catalogPrice: Number(priced.catalogPrice),
      unitPrice: Number(priced.unitPrice),
      lineTotal: Number(priced.unitPrice.mul(quantity)),
      bonus: Number(priced.bonus),
      bonusPct: priced.bonusPct,
      ruleId: priced.ruleId,
      ruleName: priced.ruleName,
      type: priced.type,
      stepQuantity: priced.stepQuantity,
      bonusQuantity: priced.bonusQuantity,
      deliveredQuantity: quantity + priced.bonusQuantity,
    };
  }

  ctxFromClient(
    client: { id: string; segment: ClientSegment; zone?: string | null },
    driverId?: string | null,
  ): PricingContext {
    return {
      clientId: client.id,
      segment: client.segment,
      zone: client.zone,
      driverId: driverId || null,
    };
  }

  async priceLine(
    ctx: PricingContext,
    product: { id: string; unitPrice: Prisma.Decimal },
    quantity: number,
  ): Promise<PricedLine> {
    const rules = await this.findActive();
    return this.apply(rules, ctx, product, quantity);
  }

  apply(
    rules: PricingRule[],
    ctx: PricingContext,
    product: { id: string; unitPrice: Prisma.Decimal },
    quantity: number,
  ): PricedLine {
    const catalog = new Prisma.Decimal(product.unitPrice);
    const rule = this.pickRule(rules, ctx, product.id, quantity);
    const step = Math.max(1, rule?.stepQuantity ?? 1);
    let bonusQty = 0;
    let unit = catalog;
    if (rule?.type === PricingRuleType.ARTICLE_OFFERT) {
      const perLot = Math.max(0, Math.floor(Number(rule.value)));
      bonusQty = Math.floor(quantity / step) * perLot;
    } else if (rule?.type === PricingRuleType.FIXED) {
      unit = new Prisma.Decimal(rule.value);
    }
    if (unit.lt(0)) unit = new Prisma.Decimal(0);
    unit = unit.toDecimalPlaces(2);
    const bonus = catalog.mul(bonusQty).toDecimalPlaces(2);
    const bonusPct = quantity > 0
      ? Math.round((bonusQty / quantity) * 10000) / 100
      : 0;
    return {
      catalogPrice: catalog,
      unitPrice: unit,
      bonus,
      bonusPct,
      ruleId: rule?.id ?? null,
      ruleName: rule?.name ?? null,
      type: rule?.type ?? null,
      stepQuantity: rule?.type === PricingRuleType.ARTICLE_OFFERT ? step : 1,
      bonusQuantity: bonusQty,
    };
  }

  tiersFor(rules: PricingRule[], ctx: PricingContext, productId: string) {
    return rules
      .filter((r) => this.matches(r, ctx, productId, r.minQuantity))
      .sort((a, b) => a.minQuantity - b.minQuantity)
      .map((r) => ({
        id: r.id,
        name: r.name,
        productId: r.productId,
        minQuantity: r.minQuantity,
        maxQuantity: r.maxQuantity,
        stepQuantity: r.stepQuantity ?? 10,
        type: r.type,
        value: Number(r.value),
        priority: r.priority,
      }));
  }

  private pickRule(rules: PricingRule[], ctx: PricingContext, productId: string, quantity: number): PricingRule | null {
    const matches = rules.filter((r) => this.matches(r, ctx, productId, quantity));
    if (!matches.length) return null;
    matches.sort((a, b) => {
      const spec = this.specificity(b) - this.specificity(a);
      if (spec) return spec;
      if (b.priority !== a.priority) return b.priority - a.priority;
      const spanA = (a.maxQuantity ?? 1_000_000) - a.minQuantity;
      const spanB = (b.maxQuantity ?? 1_000_000) - b.minQuantity;
      return spanA - spanB;
    });
    return matches[0];
  }

  private matches(rule: PricingRule, ctx: PricingContext, productId: string, quantity: number): boolean {
    if (!rule.isActive) return false;
    if (quantity < rule.minQuantity) return false;
    if (rule.maxQuantity != null && quantity > rule.maxQuantity) return false;
    if (rule.productId && rule.productId !== productId) return false;
    if (rule.clientId && rule.clientId !== ctx.clientId) return false;
    if (rule.driverId && rule.driverId !== ctx.driverId) return false;
    if (rule.segment && rule.segment !== ctx.segment) return false;
    if (rule.zone && normZone(rule.zone) !== normZone(ctx.zone)) return false;
    return true;
  }

  private specificity(rule: PricingRule): number {
    return (rule.clientId ? 1000 : 0)
      + (rule.driverId ? 100 : 0)
      + (rule.zone ? 10 : 0)
      + (rule.segment ? 1 : 0)
      + (rule.productId ? 0.5 : 0);
  }

  private toData(dto: CreatePricingRuleDto) {
    return {
      name: dto.name,
      segment: dto.segment || null,
      clientId: dto.clientId || null,
      zone: emptyToNull(dto.zone),
      driverId: dto.driverId || null,
      productId: dto.productId || null,
      minQuantity: dto.minQuantity ?? 1,
      maxQuantity: dto.maxQuantity ?? null,
      stepQuantity: dto.stepQuantity ?? 10,
      type: dto.type,
      value: dto.value,
      priority: dto.priority ?? 0,
      isActive: dto.isActive ?? true,
    };
  }

  private async assertRefs(clientId?: string | null, driverId?: string | null) {
    if (clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: clientId } });
      if (!client) throw new NotFoundException('Client introuvable');
    }
    if (driverId) {
      const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
      if (!driver) throw new NotFoundException('Livreur introuvable');
      if (driver.role !== UserRole.LIVREUR && driver.role !== UserRole.CHARGE_LIVRAISON) {
        throw new BadRequestException('Le tarif preferentiel livreur doit cibler un livreur ou un charge de livraison');
      }
    }
  }

  private assertRange(minQuantity: number, maxQuantity?: number | null) {
    if (maxQuantity != null && maxQuantity < minQuantity) {
      throw new BadRequestException('La quantite maximale doit etre superieure ou egale a la quantite minimale');
    }
  }

  private assertStep(stepQuantity: number) {
    if (stepQuantity < 1) {
      throw new BadRequestException('Le lot de bonus doit etre d au moins 1 article');
    }
  }

  private assertValue(type: PricingRuleType, value: number, stepQuantity = 10) {
    if (type !== PricingRuleType.ARTICLE_OFFERT) return;
    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException('Le bonus doit etre un nombre entier d au moins 1 article offert');
    }
    if (value > stepQuantity) {
      throw new BadRequestException('Le nombre d articles offerts ne peut pas depasser la taille du lot');
    }
  }
}
