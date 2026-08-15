import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  IotSensor,
  NotificationCategory,
  NotificationType,
  Prisma,
  ProductionOrderStatus,
  QualityCheckStatus,
  SensorKind,
  SensorStatus,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';

export interface CreateSensorInput {
  code: string;
  label: string;
  kind: SensorKind;
  metric: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  machineCode?: string;
  lineCode?: string;
  vehicleId?: string;
  fountainId?: string;
}

export type UpdateSensorInput = Partial<CreateSensorInput> & { status?: SensorStatus };

export interface IngestBatch {
  readings: Array<{ sensorCode: string; value: number; recordedAt?: string }>;
}

/** Sans relevé au-delà de ce délai, un capteur actif est déclaré hors ligne (perte de télémétrie). */
const OFFLINE_AFTER_MS = 30 * 60 * 1000;

/** Fenêtre anti-harcèlement appliquée aux alertes hors plage (EF-IOT-04). */
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

/** Seuil de remplissage déclenchant le réapprovisionnement d'une fontaine (EF-IOT-03). */
export const REFILL_THRESHOLD_PCT = 20;

/** Mesure portée par un capteur de fontaine et reportée sur FountainAsset.fillLevelPct. */
export const FOUNTAIN_LEVEL_METRIC = 'niveau';

/** Mesures attendues d'un véhicule équipé (EF-IOT-02). */
export const VEHICLE_METRICS = {
  latitude: 'position_lat',
  longitude: 'position_lng',
  speed: 'vitesse',
  fuel: 'carburant',
} as const;

type QualityField = 'ph' | 'tds' | 'turbidity' | 'chlorineFree';

/** Correspondance mesure capteur → champ du contrôle qualité (EF-IOT-01). */
const QUALITY_FIELD_BY_METRIC: Record<string, QualityField> = {
  ph: 'ph',
  chlore: 'chlorineFree',
  conductivite: 'tds',
  tds: 'tds',
  turbidite: 'turbidity',
};

/** Profils responsables destinataires d'une mesure hors plage (EF-IOT-04). */
const ALERT_ROLES_BY_KIND: Record<SensorKind, UserRole[]> = {
  QUALITE_LIGNE: [UserRole.RESP_QUALITE, UserRole.CHEF_PRODUCTION],
  VEHICULE: [UserRole.CHEF_EXPLOITATION, UserRole.CHARGE_EXPLOITATION],
  FONTAINE: [UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION],
};

const SENSOR_RELATIONS = {
  vehicle: { select: { plate: true, name: true } },
  fountain: { select: { serialNumber: true } },
};

export function normalizeMetric(metric: string): string {
  return metric
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

@Injectable()
export class IotService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findSensors(kind?: string) {
    if (kind && !(kind in SensorKind)) {
      throw new BadRequestException('Type de capteur inconnu.');
    }
    await this.detectSignalLoss();
    const sensors = await this.prisma.iotSensor.findMany({
      where: kind ? { kind: kind as SensorKind } : {},
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
      include: {
        ...SENSOR_RELATIONS,
        readings: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });
    return sensors.map(({ readings, ...sensor }) => ({
      ...sensor,
      lastValue: readings[0]?.value,
      outOfRange: readings[0]?.outOfRange ?? false,
    }));
  }

  createSensor(input: CreateSensorInput) {
    return this.prisma.iotSensor.create({
      data: {
        code: input.code,
        label: input.label,
        kind: input.kind,
        metric: input.metric,
        unit: input.unit,
        minValue: input.minValue ?? null,
        maxValue: input.maxValue ?? null,
        machineCode: input.machineCode || null,
        lineCode: input.lineCode || null,
        vehicleId: input.vehicleId || null,
        fountainId: input.fountainId || null,
      },
      include: SENSOR_RELATIONS,
    });
  }

  async updateSensor(id: string, input: UpdateSensorInput) {
    await this.getSensorOrFail(id);
    const data: Prisma.IotSensorUncheckedUpdateInput = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.label !== undefined) data.label = input.label;
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.metric !== undefined) data.metric = input.metric;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.status !== undefined) data.status = input.status;
    if (input.minValue !== undefined) data.minValue = input.minValue ?? null;
    if (input.maxValue !== undefined) data.maxValue = input.maxValue ?? null;
    if (input.machineCode !== undefined) data.machineCode = input.machineCode || null;
    if (input.lineCode !== undefined) data.lineCode = input.lineCode || null;
    if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId || null;
    if (input.fountainId !== undefined) data.fountainId = input.fountainId || null;
    return this.prisma.iotSensor.update({
      where: { id },
      data,
      include: SENSOR_RELATIONS,
    });
  }

  async deleteSensor(id: string) {
    await this.getSensorOrFail(id);
    await this.prisma.iotSensor.delete({ where: { id } });
  }

  async findReadings(sensorId: string, limit = 50) {
    await this.getSensorOrFail(sensorId);
    return this.prisma.sensorReading.findMany({
      where: { sensorId },
      orderBy: { recordedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  async createReading(sensorId: string, value: number) {
    const sensor = await this.getSensorOrFail(sensorId);
    return this.recordReading(sensor, value);
  }

  /**
   * Point d'entrée de la passerelle MQTT : absorbe un lot de relevés et écarte
   * les codes de capteur inconnus sans interrompre le traitement du lot.
   */
  async ingest(batch: IngestBatch) {
    const rows = Array.isArray(batch?.readings) ? batch.readings : [];
    let accepted = 0;
    let rejected = 0;
    let alerts = 0;
    if (rows.length === 0) return { accepted, rejected, alerts };

    const codes = Array.from(new Set(rows.map((row) => row?.sensorCode).filter(Boolean)));
    const sensors = codes.length
      ? await this.prisma.iotSensor.findMany({ where: { code: { in: codes } } })
      : [];
    const byCode = new Map(sensors.map((sensor) => [sensor.code, sensor]));

    for (const row of rows) {
      const sensor = byCode.get(row?.sensorCode);
      if (!sensor || !Number.isFinite(row?.value)) {
        rejected += 1;
        continue;
      }
      const reading = await this.recordReading(sensor, row.value, row.recordedAt);
      byCode.set(sensor.code, {
        ...sensor,
        status: SensorStatus.ACTIF,
        lastSeenAt: reading.recordedAt,
      });
      accepted += 1;
      if (reading.outOfRange) alerts += 1;
    }
    return { accepted, rejected, alerts };
  }

  /**
   * Enregistrement d'un relevé : contrôle de plage, réveil du capteur puis
   * propagation métier (EF-IOT-01, EF-IOT-03, EF-IOT-04).
   */
  private async recordReading(sensor: IotSensor, value: number, recordedAt?: string) {
    if (!Number.isFinite(value)) {
      throw new BadRequestException('La valeur du relevé doit être un nombre.');
    }
    const outOfRange = this.isOutOfRange(sensor, value);
    const alreadyAlerted = outOfRange ? await this.hasRecentOutOfRange(sensor.id) : false;

    const reading = await this.prisma.sensorReading.create({
      data: {
        sensorId: sensor.id,
        value,
        outOfRange,
        recordedAt: this.parseDate(recordedAt),
      },
    });
    await this.prisma.iotSensor.update({
      where: { id: sensor.id },
      data: { lastSeenAt: reading.recordedAt, status: SensorStatus.ACTIF },
    });

    if (sensor.kind === SensorKind.QUALITE_LIGNE) {
      await this.pushQualityMeasure(sensor, value);
    }
    if (sensor.kind === SensorKind.FONTAINE) {
      await this.applyFountainLevel(sensor, value);
    }
    if (outOfRange && !alreadyAlerted) {
      await this.raiseOutOfRangeAlert(sensor, value);
    }
    return reading;
  }

  /**
   * EF-IOT-01 : la mesure du capteur en ligne alimente le contrôle qualité en
   * attente du lot en cours sur la ligne, sans jamais toucher un contrôle validé.
   */
  private async pushQualityMeasure(sensor: IotSensor, value: number) {
    const field = QUALITY_FIELD_BY_METRIC[normalizeMetric(sensor.metric)];
    if (!field || !sensor.lineCode) return;

    const order = await this.prisma.productionOrder.findFirst({
      where: { lineCode: sensor.lineCode, status: ProductionOrderStatus.EN_COURS },
      orderBy: { createdAt: 'desc' },
      select: { id: true, lotNumber: true },
    });
    if (!order) return;

    const pending = await this.prisma.qualityCheck.findFirst({
      where: { lotNumber: order.lotNumber, status: QualityCheckStatus.EN_ATTENTE },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const measure = this.qualityMeasure(field, value);
    if (pending) {
      await this.prisma.qualityCheck.update({ where: { id: pending.id }, data: measure });
      return;
    }
    await this.prisma.qualityCheck.create({
      data: {
        lotNumber: order.lotNumber,
        productionOrderId: order.id,
        status: QualityCheckStatus.EN_ATTENTE,
        ...measure,
      },
    });
  }

  private qualityMeasure(field: QualityField, value: number) {
    return {
      ph: field === 'ph' ? value : undefined,
      tds: field === 'tds' ? value : undefined,
      turbidity: field === 'turbidity' ? value : undefined,
      chlorineFree: field === 'chlorineFree' ? value : undefined,
    };
  }

  /** EF-IOT-03 : report du niveau mesuré sur la fontaine et alerte de réapprovisionnement. */
  private async applyFountainLevel(sensor: IotSensor, value: number) {
    if (!sensor.fountainId || normalizeMetric(sensor.metric) !== FOUNTAIN_LEVEL_METRIC) return;

    const fillLevelPct = Math.min(100, Math.max(0, value));
    const fountain = await this.prisma.fountainAsset.update({
      where: { id: sensor.fountainId },
      data: { fillLevelPct },
      select: { serialNumber: true, clientId: true },
    });
    if (fillLevelPct >= REFILL_THRESHOLD_PCT) return;

    const client = fountain.clientId
      ? await this.prisma.client.findUnique({
          where: { id: fountain.clientId },
          select: { name: true },
        })
      : null;
    await this.notifications.notifyRoles(
      [UserRole.COMMERCIAL, UserRole.CHEF_EXPLOITATION, UserRole.ADMIN],
      {
        title: `Réapprovisionnement fontaine ${fountain.serialNumber}`,
        message:
          `Niveau de remplissage à ${fillLevelPct.toFixed(0)} %` +
          `${client ? ` chez ${client.name}` : ''} — seuil d'alerte fixé à ${REFILL_THRESHOLD_PCT} %.`,
        type: NotificationType.ALERT,
        category: NotificationCategory.IOT,
        link: '/iot',
      },
    );
  }

  /** EF-IOT-04 : notification immédiate au profil responsable du type de capteur. */
  private async raiseOutOfRangeAlert(sensor: IotSensor, value: number) {
    await this.notifications.notifyRoles([...ALERT_ROLES_BY_KIND[sensor.kind], UserRole.ADMIN], {
      title: `Capteur hors plage — ${sensor.code}`,
      message:
        `${sensor.label} a relevé ${value} ${sensor.unit}, hors de la plage attendue ` +
        `(${this.formatRange(sensor)}).`,
      type: NotificationType.ALERT,
      category: NotificationCategory.IOT,
      link: '/iot',
    });
  }

  /**
   * Maîtrise du risque « perte de télémétrie » : bascule des capteurs muets en
   * HORS_LIGNE avec une alerte unique par capteur.
   */
  async detectSignalLoss(): Promise<number> {
    const threshold = new Date(Date.now() - OFFLINE_AFTER_MS);
    const stale = await this.prisma.iotSensor.findMany({
      where: {
        status: SensorStatus.ACTIF,
        OR: [{ lastSeenAt: { lt: threshold } }, { lastSeenAt: null, createdAt: { lt: threshold } }],
      },
      select: { id: true, code: true, label: true, lastSeenAt: true },
    });

    let switched = 0;
    for (const sensor of stale) {
      // Le filtre sur ACTIF garantit qu'un capteur déjà hors ligne ne renotifie pas.
      const { count } = await this.prisma.iotSensor.updateMany({
        where: { id: sensor.id, status: SensorStatus.ACTIF },
        data: { status: SensorStatus.HORS_LIGNE },
      });
      if (count === 0) continue;
      switched += 1;
      const silence = sensor.lastSeenAt
        ? `depuis ${Math.round((Date.now() - sensor.lastSeenAt.getTime()) / 60000)} minutes`
        : 'depuis sa mise en service';
      await this.notifications.notifyRoles([UserRole.IT_GED, UserRole.ADMIN], {
        title: `Perte de signal — ${sensor.code}`,
        message: `${sensor.label} ne transmet plus de relevé ${silence}. Basculer sur la saisie manuelle en attendant le rétablissement.`,
        type: NotificationType.WARNING,
        category: NotificationCategory.IOT,
        link: '/iot',
      });
    }
    return switched;
  }

  private hasRecentOutOfRange(sensorId: string) {
    return this.prisma.sensorReading
      .findFirst({
        where: {
          sensorId,
          outOfRange: true,
          recordedAt: { gte: new Date(Date.now() - ALERT_COOLDOWN_MS) },
        },
        select: { id: true },
      })
      .then((reading) => reading !== null);
  }

  private isOutOfRange(sensor: IotSensor, value: number) {
    if (sensor.minValue !== null && value < sensor.minValue) return true;
    return sensor.maxValue !== null && value > sensor.maxValue;
  }

  private formatRange(sensor: IotSensor) {
    if (sensor.minValue !== null && sensor.maxValue !== null) {
      return `${sensor.minValue} à ${sensor.maxValue} ${sensor.unit}`;
    }
    if (sensor.minValue !== null) return `minimum ${sensor.minValue} ${sensor.unit}`;
    if (sensor.maxValue !== null) return `maximum ${sensor.maxValue} ${sensor.unit}`;
    return 'plage non paramétrée';
  }

  private parseDate(value?: string) {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private async getSensorOrFail(id: string) {
    const sensor = await this.prisma.iotSensor.findUnique({ where: { id } });
    if (!sensor) throw new NotFoundException('Capteur introuvable.');
    return sensor;
  }
}
