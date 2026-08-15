import { Injectable } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationType,
  OrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';
import {
  ExplanationFactor,
  ModelMetrics,
  ModelRunResult,
  clamp,
  dateFromEpochDay,
  epochDay,
  linearSlope,
  mean,
  normalizeWeights,
  round4,
  stdDev,
  sum,
  toJsonFactors,
  toJsonMetrics,
} from './ai.types';

const MODEL_NAME = 'prevision-demande';
const MODEL_VERSION = 'ma4-dow-v1';
const HISTORY_DAYS = 56;
const MOVING_AVERAGE_DAYS = 28;
const HORIZON_DAYS = 7;
const TREND_DAMPING = 0.5;
const MIN_OBSERVATIONS = 5;
const BACKTEST_DAYS = 7;
/** OBJ-11 : la prévision à sept jours doit rester sous 12 % d'écart. */
const MAPE_TARGET_PCT = 12;

const WEEKDAY_LABELS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

/** Série quotidienne de demande pour un couple produit / zone. */
interface DemandSeries {
  productId: string;
  zone: string;
  daily: number[];
  observations: number;
}

interface Prediction {
  qty: number;
  movingAverage: number;
  weekdayIndex: number;
  trend: number;
  confidence: number;
  weekday: number;
}

@Injectable()
export class ForecastService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  findForecasts(params: { zone?: string; productId?: string }) {
    const where: Prisma.DemandForecastWhereInput = {};
    if (params.zone) where.zone = params.zone;
    if (params.productId) where.productId = params.productId;

    return this.prisma.demandForecast.findMany({
      where,
      include: { product: { select: { code: true, name: true, format: true } } },
      orderBy: [{ horizonDate: 'asc' }, { zone: 'asc' }],
    });
  }

  /** Journal de performance commun à tous les modèles (EF-IA-05). */
  findModelRuns() {
    return this.prisma.modelRun.findMany({ orderBy: { ranAt: 'desc' }, take: 100 });
  }

  /** Prévision à sept jours par produit et par zone (EF-IA-01). */
  async run(): Promise<ModelRunResult> {
    const today = epochDay(new Date());
    const startDay = today - HISTORY_DAYS;

    const { series, linesWithoutZone } = await this.loadHistory(startDay, today);
    const retained = series.filter((item) => item.observations >= MIN_OBSERVATIONS);
    const ignored = series.filter((item) => item.observations < MIN_OBSERVATIONS);
    const ignoredZones = [...new Set(ignored.map((item) => item.zone))].sort();

    const generatedAt = new Date();
    let generated = 0;
    for (const item of retained) {
      const horizons = Array.from({ length: HORIZON_DAYS }, (_, offset) => today + offset + 1);
      await Promise.all(
        horizons.map((targetDay) => this.saveForecast(item, startDay, targetDay, generatedAt)),
      );
      generated += horizons.length;
    }

    const backtest = this.backtest(retained, startDay);
    const metrics: ModelMetrics = {
      historiqueJours: HISTORY_DAYS,
      horizonJours: HORIZON_DAYS,
      seriesRetenues: retained.length,
      seriesIgnorees: ignored.length,
      observationsMinimum: MIN_OBSERVATIONS,
      zonesIgnorees: ignoredZones.length ? ignoredZones.join(', ') : 'aucune',
      lignesSansZone: linesWithoutZone,
      echantillonsRetroTest: backtest.samples,
      objectifEcartPct: MAPE_TARGET_PCT,
    };

    await this.prisma.modelRun.create({
      data: {
        modelName: MODEL_NAME,
        modelVersion: MODEL_VERSION,
        samples: generated,
        mapePct: backtest.mapePct ?? null,
        metrics: toJsonMetrics(metrics),
        ranAt: generatedAt,
      },
    });

    if (backtest.mapePct !== undefined && backtest.mapePct > MAPE_TARGET_PCT) {
      await this.notifications.notifyRoles([UserRole.ADMIN, UserRole.DATA_ANALYST], {
        title: 'Prévision de demande hors objectif',
        message:
          `L'écart moyen mesuré sur les ${BACKTEST_DAYS} derniers jours atteint ` +
          `${backtest.mapePct.toFixed(1)} %, au-delà de la cible de ${MAPE_TARGET_PCT} % fixée par l'objectif OBJ-11.`,
        type: NotificationType.WARNING,
        category: NotificationCategory.IA,
        link: '/ai',
      });
    }

    return {
      generated,
      modelName: MODEL_NAME,
      modelVersion: MODEL_VERSION,
      mapePct: backtest.mapePct,
      metrics,
    };
  }

  private async loadHistory(startDay: number, endDay: number) {
    const lines = await this.prisma.orderLine.findMany({
      where: {
        order: {
          status: { not: OrderStatus.ANNULEE },
          createdAt: { gte: dateFromEpochDay(startDay), lt: dateFromEpochDay(endDay) },
        },
      },
      select: {
        productId: true,
        quantity: true,
        order: {
          select: { createdAt: true, client: { select: { zone: true } } },
        },
      },
    });

    const seriesByKey = new Map<string, DemandSeries>();
    let linesWithoutZone = 0;

    for (const line of lines) {
      const zone = line.order.client.zone;
      if (!zone) {
        linesWithoutZone += 1;
        continue;
      }
      const index = epochDay(line.order.createdAt) - startDay;
      if (index < 0 || index >= HISTORY_DAYS) continue;

      const key = `${line.productId}|${zone}`;
      let series = seriesByKey.get(key);
      if (!series) {
        series = {
          productId: line.productId,
          zone,
          daily: Array.from({ length: HISTORY_DAYS }, () => 0),
          observations: 0,
        };
        seriesByKey.set(key, series);
      }
      series.daily[index] += line.quantity;
      series.observations += 1;
    }

    return { series: [...seriesByKey.values()], linesWithoutZone };
  }

  private saveForecast(
    series: DemandSeries,
    startDay: number,
    targetDay: number,
    generatedAt: Date,
  ) {
    const prediction = this.predict(series.daily, startDay, targetDay);
    const horizonDate = dateFromEpochDay(targetDay);
    const payload = {
      forecastQty: prediction.qty,
      confidence: round4(prediction.confidence),
      factors: toJsonFactors(this.buildFactors(prediction, series)),
      modelVersion: MODEL_VERSION,
      generatedAt,
    };

    return this.prisma.demandForecast.upsert({
      where: {
        productId_zone_horizonDate: {
          productId: series.productId,
          zone: series.zone,
          horizonDate,
        },
      },
      create: {
        productId: series.productId,
        zone: series.zone,
        horizonDate,
        ...payload,
      },
      update: payload,
    });
  }

  /**
   * Moyenne mobile sur quatre semaines, corrigée du profil de jour de semaine
   * et d'une tendance hebdomadaire amortie (EF-IA-01).
   */
  private predict(daily: number[], startDay: number, targetDay: number): Prediction {
    const lastDay = startDay + daily.length - 1;
    const horizon = Math.max(1, targetDay - lastDay);
    const movingAverage = mean(daily.slice(-MOVING_AVERAGE_DAYS));
    const overallMean = mean(daily);

    const weekday = dateFromEpochDay(targetDay).getUTCDay();
    const sameWeekday = daily.filter(
      (_, index) => dateFromEpochDay(startDay + index).getUTCDay() === weekday,
    );
    const weekdayIndex =
      overallMean > 0 && sameWeekday.length
        ? clamp(mean(sameWeekday) / overallMean, 0.2, 3)
        : 1;

    const weeklyTotals: number[] = [];
    for (let end = daily.length; end - 7 >= 0; end -= 7) {
      weeklyTotals.unshift(sum(daily.slice(end - 7, end)));
    }
    const trend = (linearSlope(weeklyTotals) / 7) * horizon * TREND_DAMPING;

    const level = Math.max(0, movingAverage + trend);
    const variation = overallMean > 0 ? stdDev(daily) / overallMean : 1;

    return {
      qty: Math.max(0, Math.round(level * weekdayIndex)),
      movingAverage,
      weekdayIndex,
      trend,
      confidence: clamp(1 - variation, 0.05, 0.95),
      weekday,
    };
  }

  private buildFactors(prediction: Prediction, series: DemandSeries): ExplanationFactor[] {
    // Les trois termes du modèle se partagent un poids total de 1 ; la profondeur
    // d'historique est exprimée séparément par son taux de couverture.
    const [levelWeight, weekdayWeight, trendWeight] = normalizeWeights([
      prediction.movingAverage,
      prediction.movingAverage * (prediction.weekdayIndex - 1),
      prediction.trend,
    ]);

    return [
      {
        label: 'Moyenne des 4 dernières semaines',
        weight: levelWeight,
        detail: `${prediction.movingAverage.toFixed(1)} unité(s) par jour`,
      },
      {
        label: `Indice du ${WEEKDAY_LABELS[prediction.weekday]}`,
        weight: weekdayWeight,
        detail: `${prediction.weekdayIndex.toFixed(2)} fois la moyenne quotidienne`,
      },
      {
        label: 'Tendance amortie',
        weight: trendWeight,
        detail: `${prediction.trend >= 0 ? '+' : ''}${prediction.trend.toFixed(1)} unité(s), amortissement ${TREND_DAMPING}`,
      },
      {
        label: 'Nombre d\'observations',
        weight: round4(clamp(series.observations / HISTORY_DAYS, 0, 1)),
        detail: `${series.observations} ligne(s) de commande sur ${HISTORY_DAYS} jours`,
      },
    ];
  }

  /**
   * Rétro-test : on rejoue la prévision des sept derniers jours à partir du seul
   * historique antérieur, puis on la compare au réalisé (EF-IA-05).
   */
  private backtest(series: DemandSeries[], startDay: number): { mapePct?: number; samples: number } {
    const errors: number[] = [];

    for (const item of series) {
      for (let offset = HISTORY_DAYS - BACKTEST_DAYS; offset < HISTORY_DAYS; offset += 1) {
        const actual = item.daily[offset];
        // L'écart relatif n'a pas de sens sur une journée sans demande observée.
        if (actual <= 0) continue;
        const history = item.daily.slice(0, offset);
        if (history.length < MOVING_AVERAGE_DAYS) continue;
        const prediction = this.predict(history, startDay, startDay + offset);
        errors.push(Math.abs(prediction.qty - actual) / actual);
      }
    }

    if (!errors.length) return { samples: 0 };
    return { mapePct: Number((mean(errors) * 100).toFixed(2)), samples: errors.length };
  }
}
