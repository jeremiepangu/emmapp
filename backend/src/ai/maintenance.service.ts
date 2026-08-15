import { Injectable } from '@nestjs/common';
import { NotificationCategory, NotificationType, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';
import {
  ExplanationFactor,
  MS_PER_DAY,
  MS_PER_HOUR,
  ModelMetrics,
  ModelRunResult,
  clamp,
  mean,
  normalizeWeights,
  round4,
  sum,
  toJsonFactors,
  toJsonMetrics,
} from './ai.types';

const MODEL_NAME = 'maintenance-predictive';
const MODEL_VERSION = 'risque-pondere-v1';
const WINDOW_DAYS = 14;
const DRIFT_WINDOW_DAYS = 7;

const WEIGHT_OUT_OF_RANGE = 0.35;
const WEIGHT_DRIFT = 0.25;
const WEIGHT_UNDER_PRODUCTION = 0.25;
const WEIGHT_USAGE = 0.15;

const PREDICTION_THRESHOLD = 0.6;
const ALERT_THRESHOLD = 0.7;
/** OBJ-12 : la panne doit être annoncée au moins 48 heures à l'avance. */
const MIN_LEAD_HOURS = 48;
const MAX_LEAD_HOURS = 14 * 24;

interface Equipment {
  equipmentCode: string;
  lineCode: string;
  sensorIds: string[];
}

interface RiskComponents {
  outOfRangeRate: number;
  drift: number;
  underProduction: number;
  usage: number;
  readings: number;
  productionOrders: number;
}

@Injectable()
export class MaintenanceService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Dernier score connu par équipement, du plus risqué au moins risqué. */
  async findLatestRisks() {
    const rows = await this.prisma.maintenanceRisk.findMany({
      orderBy: { computedAt: 'desc' },
      take: 500,
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latest.has(row.equipmentCode)) latest.set(row.equipmentCode, row);
    }
    return [...latest.values()].sort((a, b) => b.riskScore - a.riskScore);
  }

  /** Estimation de la probabilité de panne par équipement (EF-IA-03, OBJ-12). */
  async run(): Promise<ModelRunResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS * MS_PER_DAY);
    const driftPivot = new Date(now.getTime() - DRIFT_WINDOW_DAYS * MS_PER_DAY);

    const [distinctLines, sensors, productionOrders] = await Promise.all([
      this.prisma.productionOrder.findMany({
        distinct: ['lineCode'],
        select: { lineCode: true },
      }),
      this.prisma.iotSensor.findMany({
        select: { id: true, code: true, machineCode: true, lineCode: true },
      }),
      this.prisma.productionOrder.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { lineCode: true, plannedQty: true, producedQty: true },
      }),
    ]);

    const equipments = this.buildEquipments(distinctLines, sensors);
    const readings = equipments.length
      ? await this.prisma.sensorReading.findMany({
          where: {
            recordedAt: { gte: windowStart },
            sensorId: { in: [...new Set(equipments.flatMap((item) => item.sensorIds))] },
          },
          select: { sensorId: true, value: true, outOfRange: true, recordedAt: true },
        })
      : [];

    const readingsBySensor = new Map<
      string,
      Array<{ value: number; outOfRange: boolean; recordedAt: Date }>
    >();
    for (const reading of readings) {
      const bucket = readingsBySensor.get(reading.sensorId) ?? [];
      bucket.push(reading);
      readingsBySensor.set(reading.sensorId, bucket);
    }

    const ordersByLine = new Map<string, Array<{ plannedQty: number; producedQty: number }>>();
    for (const order of productionOrders) {
      const bucket = ordersByLine.get(order.lineCode) ?? [];
      bucket.push(order);
      ordersByLine.set(order.lineCode, bucket);
    }

    const maxOrders = Math.max(
      1,
      ...equipments.map((item) => ordersByLine.get(item.lineCode)?.length ?? 0),
    );

    const computedAt = now;
    const scored = equipments.map((equipment) => {
      const components = this.computeComponents(
        equipment,
        readingsBySensor,
        ordersByLine,
        driftPivot,
        maxOrders,
      );
      const riskScore = clamp(
        WEIGHT_OUT_OF_RANGE * components.outOfRangeRate +
          WEIGHT_DRIFT * components.drift +
          WEIGHT_UNDER_PRODUCTION * components.underProduction +
          WEIGHT_USAGE * components.usage,
        0,
        1,
      );
      return {
        equipmentCode: equipment.equipmentCode,
        lineCode: equipment.lineCode,
        riskScore: round4(riskScore),
        factors: this.buildFactors(components),
        predictedFailureAt: this.predictFailure(riskScore, now),
      };
    });

    if (scored.length) {
      await this.prisma.maintenanceRisk.createMany({
        data: scored.map((item) => ({
          equipmentCode: item.equipmentCode,
          lineCode: item.lineCode,
          riskScore: item.riskScore,
          factors: toJsonFactors(item.factors),
          predictedFailureAt: item.predictedFailureAt,
          computedAt,
        })),
      });
    }

    for (const item of scored) {
      if (item.riskScore < ALERT_THRESHOLD) continue;
      await this.notifications.notifyRoles(
        [UserRole.CHEF_PRODUCTION, UserRole.ADMIN, UserRole.IT_GED],
        {
          title: `Risque de panne élevé — ${item.equipmentCode}`,
          message:
            `Le score de risque de l'équipement ${item.equipmentCode} (ligne ${item.lineCode || 'non renseignée'}) ` +
            `atteint ${(item.riskScore * 100).toFixed(0)} %` +
            (item.predictedFailureAt
              ? `, panne estimée avant le ${item.predictedFailureAt.toISOString().slice(0, 16).replace('T', ' à ')}.`
              : '.'),
          type: NotificationType.ALERT,
          category: NotificationCategory.IA,
          link: '/ai',
        },
      );
    }

    const atRisk = scored.filter((item) => item.riskScore >= PREDICTION_THRESHOLD).length;
    const metrics: ModelMetrics = {
      equipementsAnalyses: scored.length,
      equipementsARisque: atRisk,
      alertesEmises: scored.filter((item) => item.riskScore >= ALERT_THRESHOLD).length,
      fenetreJours: WINDOW_DAYS,
      relevesAnalyses: readings.length,
      ordresFabricationAnalyses: productionOrders.length,
      anticipationMinimaleHeures: MIN_LEAD_HOURS,
      scoreMoyen: round4(mean(scored.map((item) => item.riskScore))),
    };

    await this.prisma.modelRun.create({
      data: {
        modelName: MODEL_NAME,
        modelVersion: MODEL_VERSION,
        samples: scored.length,
        metrics: toJsonMetrics(metrics),
        ranAt: computedAt,
      },
    });

    return {
      generated: scored.length,
      modelName: MODEL_NAME,
      modelVersion: MODEL_VERSION,
      metrics,
    };
  }

  /**
   * Le parc est constitué des lignes de production et des machines instrumentées :
   * une ligne équipée d'un capteur prend le code de sa machine (EF-IA-03).
   */
  private buildEquipments(
    lines: Array<{ lineCode: string }>,
    sensors: Array<{ id: string; machineCode: string | null; lineCode: string | null }>,
  ): Equipment[] {
    const machineByLine = new Map<string, string>();
    for (const sensor of sensors) {
      if (sensor.lineCode && sensor.machineCode) machineByLine.set(sensor.lineCode, sensor.machineCode);
    }

    const equipments = new Map<string, Equipment>();
    for (const { lineCode } of lines) {
      const equipmentCode = machineByLine.get(lineCode) ?? `LIGNE-${lineCode}`;
      if (!equipments.has(equipmentCode)) {
        equipments.set(equipmentCode, { equipmentCode, lineCode, sensorIds: [] });
      }
    }
    for (const sensor of sensors) {
      if (!sensor.machineCode || equipments.has(sensor.machineCode)) continue;
      equipments.set(sensor.machineCode, {
        equipmentCode: sensor.machineCode,
        lineCode: sensor.lineCode ?? '',
        sensorIds: [],
      });
    }

    for (const equipment of equipments.values()) {
      for (const sensor of sensors) {
        const matchesMachine = !!sensor.machineCode && sensor.machineCode === equipment.equipmentCode;
        const matchesLine = !!sensor.lineCode && sensor.lineCode === equipment.lineCode;
        if (matchesMachine || matchesLine) equipment.sensorIds.push(sensor.id);
      }
    }

    return [...equipments.values()];
  }

  private computeComponents(
    equipment: Equipment,
    readingsBySensor: Map<string, Array<{ value: number; outOfRange: boolean; recordedAt: Date }>>,
    ordersByLine: Map<string, Array<{ plannedQty: number; producedQty: number }>>,
    driftPivot: Date,
    maxOrders: number,
  ): RiskComponents {
    const readings = equipment.sensorIds.flatMap((id) => readingsBySensor.get(id) ?? []);
    const outOfRangeRate = readings.length
      ? readings.filter((reading) => reading.outOfRange).length / readings.length
      : 0;

    const recent = readings.filter((reading) => reading.recordedAt >= driftPivot).map((r) => r.value);
    const previous = readings.filter((reading) => reading.recordedAt < driftPivot).map((r) => r.value);
    let drift = 0;
    if (recent.length && previous.length) {
      const previousMean = mean(previous);
      const gap = Math.abs(mean(recent) - previousMean);
      drift = previousMean !== 0 ? Math.min(1, gap / Math.abs(previousMean)) : Math.min(1, gap);
    }

    const orders = ordersByLine.get(equipment.lineCode) ?? [];
    const plannedTotal = sum(orders.map((order) => order.plannedQty));
    const shortfall = sum(
      orders.map((order) => Math.max(0, order.plannedQty - order.producedQty)),
    );
    const underProduction = plannedTotal > 0 ? clamp(shortfall / plannedTotal, 0, 1) : 0;

    return {
      outOfRangeRate,
      drift,
      underProduction,
      usage: clamp(orders.length / maxOrders, 0, 1),
      readings: readings.length,
      productionOrders: orders.length,
    };
  }

  private buildFactors(components: RiskComponents): ExplanationFactor[] {
    const weights = normalizeWeights([
      WEIGHT_OUT_OF_RANGE * components.outOfRangeRate,
      WEIGHT_DRIFT * components.drift,
      WEIGHT_UNDER_PRODUCTION * components.underProduction,
      WEIGHT_USAGE * components.usage,
    ]);

    return [
      {
        label: 'Relevés hors plage',
        weight: weights[0],
        detail: `${(components.outOfRangeRate * 100).toFixed(0)} % des ${components.readings} relevé(s) des ${WINDOW_DAYS} derniers jours`,
      },
      {
        label: 'Dérive des mesures',
        weight: weights[1],
        detail: `${(components.drift * 100).toFixed(0)} % d'écart entre les ${DRIFT_WINDOW_DAYS} derniers jours et les ${DRIFT_WINDOW_DAYS} précédents`,
      },
      {
        label: 'Sous-production de la ligne',
        weight: weights[2],
        detail: `${(components.underProduction * 100).toFixed(0)} % des quantités planifiées non produites`,
      },
      {
        label: 'Intensité d\'usage',
        weight: weights[3],
        detail: `${components.productionOrders} ordre(s) de fabrication sur ${WINDOW_DAYS} jours`,
      },
    ];
  }

  /**
   * L'échéance se resserre à mesure que le risque croît, sans jamais descendre
   * sous les 48 heures d'anticipation exigées par l'objectif OBJ-12.
   */
  private predictFailure(riskScore: number, now: Date): Date | null {
    if (riskScore < PREDICTION_THRESHOLD) return null;
    const intensity = clamp(
      (riskScore - PREDICTION_THRESHOLD) / (1 - PREDICTION_THRESHOLD),
      0,
      1,
    );
    const leadHours = MAX_LEAD_HOURS - (MAX_LEAD_HOURS - MIN_LEAD_HOURS) * intensity;
    return new Date(now.getTime() + leadHours * MS_PER_HOUR);
  }
}
