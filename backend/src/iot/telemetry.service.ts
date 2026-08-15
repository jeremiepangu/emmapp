import { Injectable } from '@nestjs/common';
import { SensorKind, SensorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import {
  FOUNTAIN_LEVEL_METRIC,
  normalizeMetric,
  REFILL_THRESHOLD_PCT,
  VEHICLE_METRICS,
} from './iot.service';

export interface VehicleTelemetry {
  vehicleId: string;
  plate: string;
  name: string;
  latitude?: number;
  longitude?: number;
  speedKmh?: number;
  fuelLevelPct?: number;
  lastSeenAt?: string;
  status: SensorStatus;
}

export interface FountainTelemetry {
  id: string;
  serialNumber: string;
  model?: string;
  clientName?: string;
  fillLevelPct?: number;
  needsRefill: boolean;
  nextService?: string;
  lastSeenAt?: string;
}

/** Le statut le plus dégradé des capteurs d'un équipement prime sur les autres. */
const STATUS_SEVERITY: Record<SensorStatus, number> = {
  ACTIF: 1,
  MAINTENANCE: 2,
  HORS_LIGNE: 3,
};

@Injectable()
export class TelemetryService {
  constructor(private prisma: PrismaService) {}

  /** EF-IOT-02 : position, vitesse et carburant agrégés depuis les capteurs du véhicule. */
  async getVehicleTelemetry(): Promise<VehicleTelemetry[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { sensors: { some: { kind: SensorKind.VEHICULE } } },
      orderBy: { plate: 'asc' },
      include: {
        sensors: {
          where: { kind: SensorKind.VEHICULE },
          select: {
            metric: true,
            status: true,
            readings: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    return vehicles.map((vehicle) => {
      const latest = (metric: string) =>
        vehicle.sensors.find((sensor) => normalizeMetric(sensor.metric) === metric)?.readings[0]
          ?.value;
      const lastSeenAt = vehicle.sensors
        .map((sensor) => sensor.readings[0]?.recordedAt)
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const status = vehicle.sensors.reduce(
        (worst, sensor) =>
          STATUS_SEVERITY[sensor.status] > STATUS_SEVERITY[worst] ? sensor.status : worst,
        SensorStatus.ACTIF as SensorStatus,
      );

      return {
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        name: vehicle.name,
        latitude: latest(VEHICLE_METRICS.latitude),
        longitude: latest(VEHICLE_METRICS.longitude),
        speedKmh: latest(VEHICLE_METRICS.speed),
        fuelLevelPct: latest(VEHICLE_METRICS.fuel),
        lastSeenAt: lastSeenAt?.toISOString(),
        status,
      };
    });
  }

  /** EF-IOT-03 : parc de fontaines avec niveau de remplissage et besoin de réapprovisionnement. */
  async getConnectedFountains(): Promise<FountainTelemetry[]> {
    const fountains = await this.prisma.fountainAsset.findMany({
      where: { isActive: true },
      orderBy: { serialNumber: 'asc' },
      include: {
        sensors: {
          where: { kind: SensorKind.FONTAINE },
          select: {
            metric: true,
            lastSeenAt: true,
            readings: { orderBy: { recordedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    // FountainAsset.clientId n'a pas de relation Prisma déclarée : rapprochement en mémoire.
    const clientIds = Array.from(
      new Set(
        fountains.map((fountain) => fountain.clientId).filter((id): id is string => Boolean(id)),
      ),
    );
    const clients = clientIds.length
      ? await this.prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
    const clientNameById = new Map(clients.map((client) => [client.id, client.name]));

    return fountains.map((fountain) => {
      const levelSensor = fountain.sensors.find(
        (sensor) => normalizeMetric(sensor.metric) === FOUNTAIN_LEVEL_METRIC,
      );
      const fillLevelPct = levelSensor?.readings[0]?.value ?? fountain.fillLevelPct ?? undefined;
      const lastSeenAt = levelSensor?.readings[0]?.recordedAt ?? levelSensor?.lastSeenAt ?? null;

      return {
        id: fountain.id,
        serialNumber: fountain.serialNumber,
        model: fountain.model ?? undefined,
        clientName: fountain.clientId ? clientNameById.get(fountain.clientId) : undefined,
        fillLevelPct,
        needsRefill: fillLevelPct !== undefined && fillLevelPct < REFILL_THRESHOLD_PCT,
        nextService: fountain.nextService?.toISOString(),
        lastSeenAt: lastSeenAt?.toISOString(),
      };
    });
  }
}
