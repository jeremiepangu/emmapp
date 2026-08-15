import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AnomalyKind,
  AnomalySeverity,
  AnomalyStatus,
  NotificationCategory,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ProductionOrderStatus,
  SensorStatus,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';
import {
  ExplanationFactor,
  MS_PER_DAY,
  MS_PER_HOUR,
  ModelMetrics,
  ModelRunResult,
  clamp,
  epochDay,
  mean,
  normalizeWeights,
  round4,
  stdDev,
  toJsonFactors,
  toJsonMetrics,
} from './ai.types';

const MODEL_NAME = 'detection-anomalies';
const MODEL_VERSION = 'regles-zscore-v1';
const STAT_WINDOW_DAYS = 30;
const DAILY_REFERENCE_DAYS = 14;
const PAYMENT_HISTORY_DAYS = 180;
/** Population minimale au-delà de laquelle un écart-type devient exploitable. */
const MIN_POPULATION = 5;
/** Un écart de cinq écarts-types correspond au score maximal. */
const SIGMA_FOR_MAX_SCORE = 5;
const STOCK_Z_THRESHOLD = -2;
const CONSIGNE_Z_THRESHOLD = 2;
const PAYMENT_Z_THRESHOLD = 3;
const PRODUCTION_DEVIATION_THRESHOLD = 0.15;
/** Un écart de production de 50 % vaut le score maximal. */
const PRODUCTION_DEVIATION_FOR_MAX_SCORE = 0.5;
const SENSOR_OUT_OF_RANGE_THRESHOLD = 3;
const SENSOR_SILENCE_HOURS = 6;
/** Un silence de 48 h vaut le score maximal. */
const SENSOR_SILENCE_FOR_MAX_SCORE = 48;
const DAILY_COLLECTION_DROP_THRESHOLD = 0.5;

const PENDING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.VALIDEE,
  OrderStatus.EN_PREPARATION,
  OrderStatus.CHARGEE,
  OrderStatus.EN_LIVRAISON,
];

/** Destinataires métier des alertes, par famille d'anomalie (EF-IA-02). */
const KIND_ROLES: Record<AnomalyKind, UserRole[]> = {
  [AnomalyKind.STOCK]: [UserRole.MAGASINIER, UserRole.CHEF_EXPLOITATION],
  [AnomalyKind.CONSIGNE]: [UserRole.RESP_QUALITE, UserRole.COMMERCIAL],
  [AnomalyKind.ENCAISSEMENT]: [UserRole.COMPTABLE, UserRole.CAISSIER, UserRole.DG],
  [AnomalyKind.PRODUCTION]: [UserRole.CHEF_PRODUCTION],
  [AnomalyKind.CAPTEUR]: [UserRole.IT_GED, UserRole.RESP_QUALITE],
};

const ALWAYS_NOTIFIED_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.RESP_SECURITE];

interface AnomalyCandidate {
  kind: AnomalyKind;
  entityType: string;
  entityId?: string;
  title: string;
  description: string;
  score: number;
  factors: ExplanationFactor[];
}

@Injectable()
export class AnomalyService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  findAnomalies(status?: string) {
    const where: Prisma.AnomalyWhereInput = {};
    if (status) {
      if (!(status in AnomalyStatus)) throw new BadRequestException('Statut d\'anomalie invalide');
      where.status = status as AnomalyStatus;
    }
    return this.prisma.anomaly.findMany({ where, orderBy: { detectedAt: 'desc' }, take: 200 });
  }

  async updateStatus(id: string, status: string, userId: string) {
    if (!(status in AnomalyStatus)) throw new BadRequestException('Statut d\'anomalie invalide');
    const existing = await this.prisma.anomaly.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Anomalie introuvable');

    const nextStatus = status as AnomalyStatus;
    const closed = nextStatus === AnomalyStatus.RESOLUE || nextStatus === AnomalyStatus.IGNOREE;

    return this.prisma.anomaly.update({
      where: { id },
      data: {
        status: nextStatus,
        resolvedAt: closed ? new Date() : null,
        resolvedById: closed ? userId : null,
      },
    });
  }

  /** Analyse des cinq familles d'écarts significatifs (EF-IA-02). */
  async run(): Promise<ModelRunResult> {
    const now = new Date();
    const [stock, consigne, encaissement, production, capteur] = await Promise.all([
      this.detectStock(now),
      this.detectConsigne(now),
      this.detectEncaissement(now),
      this.detectProduction(now),
      this.detectCapteur(now),
    ]);

    const candidates = [...stock, ...consigne, ...encaissement, ...production, ...capteur];
    const fresh = await this.removeDuplicates(candidates);

    const rows = fresh.map((candidate) => ({
      kind: candidate.kind,
      severity: this.severityFromScore(candidate.score),
      entityType: candidate.entityType,
      entityId: candidate.entityId ?? null,
      title: candidate.title,
      description: candidate.description,
      score: round4(candidate.score),
      factors: toJsonFactors(candidate.factors),
      detectedAt: now,
    }));

    if (rows.length) await this.prisma.anomaly.createMany({ data: rows });

    for (const row of rows) {
      if (row.severity !== AnomalySeverity.ELEVEE && row.severity !== AnomalySeverity.CRITIQUE) {
        continue;
      }
      await this.notifications.notifyRoles(
        [...KIND_ROLES[row.kind], ...ALWAYS_NOTIFIED_ROLES],
        {
          title: `Anomalie ${row.severity.toLowerCase()} — ${row.title}`,
          message: row.description,
          type: NotificationType.ALERT,
          category: NotificationCategory.IA,
          link: '/ai',
        },
      );
    }

    const metrics: ModelMetrics = {
      candidatsDetectes: candidates.length,
      anomaliesCreees: rows.length,
      doublonsIgnores: candidates.length - rows.length,
      familleStock: stock.length,
      familleConsigne: consigne.length,
      familleEncaissement: encaissement.length,
      familleProduction: production.length,
      familleCapteur: capteur.length,
      fenetreStatistiqueJours: STAT_WINDOW_DAYS,
    };

    await this.prisma.modelRun.create({
      data: {
        modelName: MODEL_NAME,
        modelVersion: MODEL_VERSION,
        samples: rows.length,
        metrics: toJsonMetrics(metrics),
        ranAt: now,
      },
    });

    return {
      generated: rows.length,
      modelName: MODEL_NAME,
      modelVersion: MODEL_VERSION,
      metrics,
    };
  }

  /** Une anomalie déjà ouverte sur la même entité ne doit pas être recréée. */
  private async removeDuplicates(candidates: AnomalyCandidate[]) {
    const open = await this.prisma.anomaly.findMany({
      where: { status: { in: [AnomalyStatus.OUVERTE, AnomalyStatus.EN_COURS] } },
      select: { kind: true, entityType: true, entityId: true },
    });
    const seen = new Set(
      open.map((item) => this.dedupKey(item.kind, item.entityType, item.entityId)),
    );

    const fresh: AnomalyCandidate[] = [];
    for (const candidate of candidates) {
      const key = this.dedupKey(candidate.kind, candidate.entityType, candidate.entityId);
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push(candidate);
    }
    return fresh;
  }

  private dedupKey(kind: AnomalyKind, entityType: string, entityId?: string | null) {
    return `${kind}|${entityType}|${entityId ?? ''}`;
  }

  private severityFromScore(score: number): AnomalySeverity {
    if (score < 0.4) return AnomalySeverity.FAIBLE;
    if (score < 0.6) return AnomalySeverity.MOYENNE;
    if (score < 0.8) return AnomalySeverity.ELEVEE;
    return AnomalySeverity.CRITIQUE;
  }

  private scoreFromZ(zScore: number): number {
    return clamp(Math.abs(zScore) / SIGMA_FOR_MAX_SCORE, 0.05, 1);
  }

  // ------------------------------------------------------------------- STOCK

  private async detectStock(now: Date): Promise<AnomalyCandidate[]> {
    const since = new Date(now.getTime() - STAT_WINDOW_DAYS * MS_PER_DAY);
    const startDay = epochDay(since);
    const dayCount = epochDay(now) - startDay;

    const [items, deliveryLines, pendingLines] = await Promise.all([
      this.prisma.stockItem.findMany({
        select: {
          id: true,
          quantity: true,
          productId: true,
          product: { select: { code: true, name: true } },
          location: { select: { code: true, name: true } },
        },
      }),
      this.prisma.deliveryLine.findMany({
        where: { delivery: { deliveredAt: { gte: since } } },
        select: {
          productId: true,
          qtyDelivered: true,
          delivery: { select: { deliveredAt: true } },
        },
      }),
      this.prisma.orderLine.findMany({
        where: { order: { status: { in: PENDING_ORDER_STATUSES } } },
        select: { productId: true, quantity: true },
      }),
    ]);

    // Sorties quotidiennes par produit : seule série de 30 jours disponible pour un article.
    const outflow = new Map<string, number[]>();
    for (const line of deliveryLines) {
      if (!line.delivery.deliveredAt) continue;
      const index = epochDay(line.delivery.deliveredAt) - startDay;
      if (index < 0 || index >= dayCount) continue;
      let series = outflow.get(line.productId);
      if (!series) {
        series = Array.from({ length: dayCount }, () => 0);
        outflow.set(line.productId, series);
      }
      series[index] += line.qtyDelivered;
    }

    const stockByProduct = new Map<string, number>();
    const labelByProduct = new Map<string, string>();
    for (const item of items) {
      stockByProduct.set(item.productId, (stockByProduct.get(item.productId) ?? 0) + item.quantity);
      labelByProduct.set(item.productId, `${item.product.code} — ${item.product.name}`);
    }

    const pendingByProduct = new Map<string, number>();
    for (const line of pendingLines) {
      pendingByProduct.set(
        line.productId,
        (pendingByProduct.get(line.productId) ?? 0) + line.quantity,
      );
    }

    const candidates: AnomalyCandidate[] = [];

    for (const item of items) {
      if (item.quantity >= 0) continue;
      candidates.push({
        kind: AnomalyKind.STOCK,
        entityType: 'StockItem',
        entityId: item.id,
        title: `Quantité négative sur ${item.product.code}`,
        description:
          `Le stock de ${item.product.name} en ${item.location.name} (${item.location.code}) ` +
          `affiche ${item.quantity} unité(s), ce qui traduit une incohérence de mouvement.`,
        // Incohérence certaine : la gravité ne dépend pas d'un seuil statistique.
        score: 0.9,
        factors: [
          {
            label: 'Quantité négative constatée',
            weight: 1,
            detail: `${item.quantity} unité(s) en ${item.location.code}`,
          },
        ],
      });
    }

    for (const [productId, series] of outflow) {
      const observedDays = series.filter((value) => value > 0).length;
      if (observedDays < MIN_POPULATION || series.length < 2) continue;
      const average = mean(series);
      const deviation = stdDev(series);
      if (deviation <= 0) continue;
      const lastValue = series[series.length - 1];
      const zScore = (lastValue - average) / deviation;
      if (zScore >= STOCK_Z_THRESHOLD) continue;

      const label = labelByProduct.get(productId) ?? productId;
      candidates.push({
        kind: AnomalyKind.STOCK,
        entityType: 'ProduitFluxStock',
        entityId: productId,
        title: `Mouvement de stock anormalement bas — ${label}`,
        description:
          `Les sorties de la dernière journée (${lastValue} unité(s)) s'écartent de ` +
          `${zScore.toFixed(1)} écart-type de la moyenne des ${STAT_WINDOW_DAYS} derniers jours ` +
          `(${average.toFixed(1)} unité(s) par jour).`,
        score: this.scoreFromZ(zScore),
        factors: this.buildZFactors(
          zScore,
          `${lastValue} unité(s) sorties sur la dernière journée`,
          `${average.toFixed(1)} unité(s) par jour sur ${STAT_WINDOW_DAYS} jours`,
          `${observedDays} journée(s) avec mouvement`,
        ),
      });
    }

    for (const [productId, pendingQty] of pendingByProduct) {
      if (pendingQty <= 0) continue;
      const available = stockByProduct.get(productId) ?? 0;
      if (available > 0) continue;

      const series = outflow.get(productId);
      const dailyOutflow = series ? mean(series) : 0;
      // Une semaine de demande non couverte porte le score au maximum.
      const uncoveredDays = dailyOutflow > 0 ? pendingQty / dailyOutflow : 7;
      const label = labelByProduct.get(productId) ?? productId;

      candidates.push({
        kind: AnomalyKind.STOCK,
        entityType: 'ProduitRupture',
        entityId: productId,
        title: `Rupture de stock — ${label}`,
        description:
          `Aucune quantité disponible alors que ${pendingQty} unité(s) restent engagées ` +
          `sur des commandes validées non livrées.`,
        score: clamp(0.6 + 0.4 * Math.min(1, uncoveredDays / 7), 0.6, 1),
        factors: [
          {
            label: 'Stock disponible',
            weight: 0.5,
            detail: `${available} unité(s) toutes localisations confondues`,
          },
          {
            label: 'Demande engagée non servie',
            weight: 0.3,
            detail: `${pendingQty} unité(s) sur commandes validées`,
          },
          {
            label: 'Couverture manquante',
            weight: 0.2,
            detail:
              dailyOutflow > 0
                ? `${uncoveredDays.toFixed(1)} jour(s) de consommation habituelle`
                : 'Consommation de référence indisponible',
          },
        ],
      });
    }

    return candidates;
  }

  // ---------------------------------------------------------------- CONSIGNE

  private async detectConsigne(now: Date): Promise<AnomalyCandidate[]> {
    const since = new Date(now.getTime() - STAT_WINDOW_DAYS * MS_PER_DAY);

    const [clients, movements] = await Promise.all([
      this.prisma.client.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          consigneBalance: true,
          consigneLimit: true,
        },
      }),
      this.prisma.consigneMovement.findMany({
        where: { createdAt: { gte: since } },
        select: { clientId: true, qtyIn: true, qtyOut: true },
      }),
    ]);

    const candidates: AnomalyCandidate[] = [];

    for (const client of clients) {
      if (client.consigneBalance <= client.consigneLimit) continue;
      const overshoot =
        client.consigneLimit > 0
          ? (client.consigneBalance - client.consigneLimit) / client.consigneLimit
          : 1;

      candidates.push({
        kind: AnomalyKind.CONSIGNE,
        entityType: 'Client',
        entityId: client.id,
        title: `Limite de consigne dépassée — ${client.name}`,
        description:
          `Le solde de consigne du client ${client.code} atteint ${client.consigneBalance} ` +
          `emballage(s) pour une limite de ${client.consigneLimit}.`,
        score: clamp(0.5 + overshoot, 0.5, 1),
        factors: [
          {
            label: 'Solde de consigne',
            weight: 0.6,
            detail: `${client.consigneBalance} emballage(s) détenus`,
          },
          {
            label: 'Limite contractuelle',
            weight: 0.4,
            detail: `${client.consigneLimit} emballage(s) autorisés, dépassement de ${(overshoot * 100).toFixed(0)} %`,
          },
        ],
      });
    }

    // Ratio retours / livraisons comparé à la population des clients actifs.
    const flows = new Map<string, { qtyIn: number; qtyOut: number }>();
    for (const movement of movements) {
      const flow = flows.get(movement.clientId) ?? { qtyIn: 0, qtyOut: 0 };
      flow.qtyIn += movement.qtyIn;
      flow.qtyOut += movement.qtyOut;
      flows.set(movement.clientId, flow);
    }

    const ratios = [...flows.entries()]
      .filter(([, flow]) => flow.qtyOut > 0)
      .map(([clientId, flow]) => ({ clientId, ratio: flow.qtyIn / flow.qtyOut, flow }));

    if (ratios.length >= MIN_POPULATION) {
      const values = ratios.map((item) => item.ratio);
      const average = mean(values);
      const deviation = stdDev(values);
      if (deviation > 0) {
        const clientsById = new Map(clients.map((client) => [client.id, client]));
        for (const item of ratios) {
          const zScore = (item.ratio - average) / deviation;
          if (zScore <= CONSIGNE_Z_THRESHOLD) continue;
          const client = clientsById.get(item.clientId);
          if (!client) continue;

          candidates.push({
            kind: AnomalyKind.CONSIGNE,
            entityType: 'ClientRotationConsigne',
            entityId: client.id,
            title: `Rotation de consigne atypique — ${client.name}`,
            description:
              `Le rapport retours / livraisons du client ${client.code} vaut ${item.ratio.toFixed(2)} ` +
              `(${item.flow.qtyIn} retours pour ${item.flow.qtyOut} sorties sur ${STAT_WINDOW_DAYS} jours), ` +
              `soit ${zScore.toFixed(1)} écart-type au-dessus de la moyenne des clients.`,
            score: this.scoreFromZ(zScore),
            factors: this.buildZFactors(
              zScore,
              `Rapport observé de ${item.ratio.toFixed(2)}`,
              `Moyenne des clients : ${average.toFixed(2)}`,
              `${ratios.length} client(s) comparés`,
            ),
          });
        }
      }
    }

    return candidates;
  }

  // ------------------------------------------------------------ ENCAISSEMENT

  private async detectEncaissement(now: Date): Promise<AnomalyCandidate[]> {
    const historySince = new Date(now.getTime() - PAYMENT_HISTORY_DAYS * MS_PER_DAY);
    const recentSince = new Date(now.getTime() - STAT_WINDOW_DAYS * MS_PER_DAY);

    const payments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: historySince } },
      select: {
        id: true,
        paymentNumber: true,
        clientId: true,
        amount: true,
        method: true,
        deliveryId: true,
        createdAt: true,
        client: { select: { code: true, name: true } },
      },
    });

    const candidates: AnomalyCandidate[] = [];

    const byClient = new Map<string, number[]>();
    for (const payment of payments) {
      if (!payment.clientId) continue;
      const values = byClient.get(payment.clientId) ?? [];
      values.push(Number(payment.amount));
      byClient.set(payment.clientId, values);
    }

    for (const payment of payments) {
      if (!payment.clientId || payment.createdAt < recentSince) continue;
      const values = byClient.get(payment.clientId) ?? [];
      if (values.length < MIN_POPULATION) continue;
      const average = mean(values);
      const deviation = stdDev(values);
      if (deviation <= 0) continue;
      const zScore = (Number(payment.amount) - average) / deviation;
      if (zScore <= PAYMENT_Z_THRESHOLD) continue;

      candidates.push({
        kind: AnomalyKind.ENCAISSEMENT,
        entityType: 'Payment',
        entityId: payment.id,
        title: `Encaissement atypique — ${payment.paymentNumber}`,
        description:
          `Le règlement de ${Number(payment.amount).toFixed(2)} du client ` +
          `${payment.client?.name ?? 'inconnu'} s'écarte de ${zScore.toFixed(1)} écart-type ` +
          `de son historique (moyenne ${average.toFixed(2)}).`,
        score: this.scoreFromZ(zScore),
        factors: this.buildZFactors(
          zScore,
          `Montant encaissé : ${Number(payment.amount).toFixed(2)}`,
          `Moyenne du client : ${average.toFixed(2)}`,
          `${values.length} règlement(s) sur ${PAYMENT_HISTORY_DAYS} jours`,
        ),
      });
    }

    for (const payment of payments) {
      if (payment.method !== PaymentMethod.ESPECES) continue;
      if (payment.deliveryId) continue;
      if (payment.createdAt < recentSince) continue;

      candidates.push({
        kind: AnomalyKind.ENCAISSEMENT,
        entityType: 'PaiementEspecesSansLivraison',
        entityId: payment.id,
        title: `Espèces sans livraison rattachée — ${payment.paymentNumber}`,
        description:
          `Le règlement en espèces de ${Number(payment.amount).toFixed(2)} n'est rattaché à ` +
          `aucune livraison, la piste d'audit est incomplète.`,
        score: 0.55,
        factors: [
          {
            label: 'Moyen de paiement',
            weight: 0.5,
            detail: 'Espèces, sans justificatif de livraison',
          },
          {
            label: 'Montant concerné',
            weight: 0.5,
            detail: `${Number(payment.amount).toFixed(2)} encaissés le ${payment.createdAt.toISOString().slice(0, 10)}`,
          },
        ],
      });
    }

    const dailyCandidate = this.detectDailyCollectionDrop(payments, now);
    if (dailyCandidate) candidates.push(dailyCandidate);

    return candidates;
  }

  private detectDailyCollectionDrop(
    payments: Array<{ amount: Prisma.Decimal; createdAt: Date }>,
    now: Date,
  ): AnomalyCandidate | null {
    // La dernière journée complète sert de référence, la journée courante étant partielle.
    const lastCompleteDay = epochDay(now) - 1;
    const firstReferenceDay = lastCompleteDay - DAILY_REFERENCE_DAYS;

    const totals = new Map<number, number>();
    for (const payment of payments) {
      const day = epochDay(payment.createdAt);
      if (day > lastCompleteDay || day < firstReferenceDay) continue;
      totals.set(day, (totals.get(day) ?? 0) + Number(payment.amount));
    }

    const reference: number[] = [];
    for (let day = firstReferenceDay; day < lastCompleteDay; day += 1) {
      reference.push(totals.get(day) ?? 0);
    }
    const average = mean(reference);
    if (average <= 0) return null;

    const dayTotal = totals.get(lastCompleteDay) ?? 0;
    const shortfall = 1 - dayTotal / average;
    if (shortfall <= DAILY_COLLECTION_DROP_THRESHOLD) return null;

    const dayLabel = new Date(lastCompleteDay * MS_PER_DAY).toISOString().slice(0, 10);
    return {
      kind: AnomalyKind.ENCAISSEMENT,
      entityType: 'EncaissementJournalier',
      entityId: dayLabel,
      title: `Encaissements du ${dayLabel} en net retrait`,
      description:
        `Le total encaissé (${dayTotal.toFixed(2)}) est inférieur de ${(shortfall * 100).toFixed(0)} % ` +
        `à la moyenne des ${DAILY_REFERENCE_DAYS} derniers jours (${average.toFixed(2)}).`,
      score: clamp(shortfall, 0.4, 1),
      factors: [
        { label: 'Total encaissé', weight: 0.4, detail: `${dayTotal.toFixed(2)} sur la journée` },
        {
          label: 'Référence sur 14 jours',
          weight: 0.4,
          detail: `${average.toFixed(2)} en moyenne quotidienne`,
        },
        {
          label: 'Retrait constaté',
          weight: 0.2,
          detail: `${(shortfall * 100).toFixed(0)} % sous la référence`,
        },
      ],
    };
  }

  // -------------------------------------------------------------- PRODUCTION

  private async detectProduction(now: Date): Promise<AnomalyCandidate[]> {
    const since = new Date(now.getTime() - STAT_WINDOW_DAYS * MS_PER_DAY);

    const orders = await this.prisma.productionOrder.findMany({
      where: {
        status: ProductionOrderStatus.TERMINE,
        plannedQty: { gt: 0 },
        OR: [{ completedAt: { gte: since } }, { completedAt: null, createdAt: { gte: since } }],
      },
      select: {
        id: true,
        orderNumber: true,
        lineCode: true,
        plannedQty: true,
        producedQty: true,
      },
    });

    return orders
      .map((order) => {
        const gap = (order.producedQty - order.plannedQty) / order.plannedQty;
        return { order, gap };
      })
      .filter(({ gap }) => Math.abs(gap) > PRODUCTION_DEVIATION_THRESHOLD)
      .map(({ order, gap }) => ({
        kind: AnomalyKind.PRODUCTION,
        entityType: 'ProductionOrder',
        entityId: order.id,
        title: `Écart de production — ${order.orderNumber}`,
        description:
          `L'ordre de fabrication de la ligne ${order.lineCode} a produit ${order.producedQty} ` +
          `unité(s) pour ${order.plannedQty} planifiée(s), soit ${(gap * 100).toFixed(0)} % d'écart.`,
        score: clamp(
          Math.abs(gap) / PRODUCTION_DEVIATION_FOR_MAX_SCORE,
          0.3,
          1,
        ),
        factors: [
          {
            label: 'Quantité planifiée',
            weight: 0.35,
            detail: `${order.plannedQty} unité(s)`,
          },
          {
            label: 'Quantité produite',
            weight: 0.35,
            detail: `${order.producedQty} unité(s)`,
          },
          {
            label: 'Écart relatif',
            weight: 0.3,
            detail: `${(gap * 100).toFixed(0)} % pour un seuil de ${PRODUCTION_DEVIATION_THRESHOLD * 100} %`,
          },
        ],
      }));
  }

  // ----------------------------------------------------------------- CAPTEUR

  private async detectCapteur(now: Date): Promise<AnomalyCandidate[]> {
    const since24h = new Date(now.getTime() - 24 * MS_PER_HOUR);

    const [sensors, totals, outOfRange, lastReadings] = await Promise.all([
      this.prisma.iotSensor.findMany({
        select: {
          id: true,
          code: true,
          label: true,
          metric: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.sensorReading.groupBy({
        by: ['sensorId'],
        where: { recordedAt: { gte: since24h } },
        _count: { _all: true },
      }),
      this.prisma.sensorReading.groupBy({
        by: ['sensorId'],
        where: { recordedAt: { gte: since24h }, outOfRange: true },
        _count: { _all: true },
      }),
      this.prisma.sensorReading.groupBy({
        by: ['sensorId'],
        _max: { recordedAt: true },
      }),
    ]);

    const totalBySensor = new Map(totals.map((row) => [row.sensorId, row._count._all]));
    const outBySensor = new Map(outOfRange.map((row) => [row.sensorId, row._count._all]));
    const lastBySensor = new Map(lastReadings.map((row) => [row.sensorId, row._max.recordedAt]));

    const candidates: AnomalyCandidate[] = [];

    for (const sensor of sensors) {
      const outCount = outBySensor.get(sensor.id) ?? 0;
      const totalCount = totalBySensor.get(sensor.id) ?? 0;

      if (outCount > SENSOR_OUT_OF_RANGE_THRESHOLD) {
        const ratio = totalCount > 0 ? outCount / totalCount : 1;
        candidates.push({
          kind: AnomalyKind.CAPTEUR,
          entityType: 'IotSensor',
          entityId: sensor.id,
          title: `Relevés hors plage — ${sensor.code}`,
          description:
            `Le capteur ${sensor.label} a produit ${outCount} relevé(s) de ${sensor.metric} ` +
            `hors plage sur les 24 dernières heures (${totalCount} relevé(s) au total).`,
          score: clamp(0.5 + ratio / 2, 0.5, 1),
          factors: [
            {
              label: 'Relevés hors plage',
              weight: 0.5,
              detail: `${outCount} sur 24 heures, seuil de ${SENSOR_OUT_OF_RANGE_THRESHOLD}`,
            },
            {
              label: 'Part des relevés concernés',
              weight: 0.3,
              detail: `${(ratio * 100).toFixed(0)} % des mesures`,
            },
            {
              label: 'Volume de mesures',
              weight: 0.2,
              detail: `${totalCount} relevé(s) transmis`,
            },
          ],
        });
      }

      if (sensor.status !== SensorStatus.ACTIF) continue;
      const reference = lastBySensor.get(sensor.id) ?? sensor.createdAt;
      const silentHours = (now.getTime() - reference.getTime()) / MS_PER_HOUR;
      if (silentHours <= SENSOR_SILENCE_HOURS) continue;

      candidates.push({
        kind: AnomalyKind.CAPTEUR,
        entityType: 'CapteurSilencieux',
        entityId: sensor.id,
        title: `Capteur actif sans relevé — ${sensor.code}`,
        description:
          `Le capteur ${sensor.label} est déclaré actif mais n'a transmis aucun relevé depuis ` +
          `${silentHours.toFixed(1)} heure(s).`,
        score: clamp(0.4 + silentHours / SENSOR_SILENCE_FOR_MAX_SCORE, 0.4, 1),
        factors: [
          {
            label: 'Durée de silence',
            weight: 0.6,
            detail: `${silentHours.toFixed(1)} heure(s) pour un seuil de ${SENSOR_SILENCE_HOURS} heures`,
          },
          {
            label: 'Statut déclaré',
            weight: 0.4,
            detail: 'Capteur marqué ACTIF dans le référentiel',
          },
        ],
      });
    }

    return candidates;
  }

  private buildZFactors(
    zScore: number,
    observed: string,
    reference: string,
    population: string,
  ): ExplanationFactor[] {
    const [observedWeight, referenceWeight, populationWeight] = normalizeWeights([
      Math.abs(zScore),
      1,
      0.5,
    ]);
    return [
      { label: 'Valeur observée', weight: observedWeight, detail: observed },
      { label: 'Référence statistique', weight: referenceWeight, detail: reference },
      { label: 'Population de comparaison', weight: populationWeight, detail: population },
    ];
  }
}
