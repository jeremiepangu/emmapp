import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EsgScope,
  NotificationCategory,
  NotificationType,
  ProductFormat,
  TourStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { pathDistanceKm } from '../routing/routing.service';

export interface EsgDashboard {
  periodStart: string;
  periodEnd: string;
  totalCo2Kg: number;
  totalDistanceKm: number;
  co2PerDeliveryKg: number;
  waterM3: number;
  energyKwh: number;
  reusePct: number;
  monthlyTrend: Array<{ month: string; co2Kg: number; distanceKm: number }>;
  topTours: Array<{ tourNumber: string; zone: string; co2Kg: number; distanceKm: number }>;
}

export interface EsgReport {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  summary: EsgDashboard;
  rows: Array<Record<string, string | number>>;
}

/** Contenance nette de chaque format commercialisé, en litres. */
const LITRES_PER_FORMAT: Record<ProductFormat, number> = {
  BIDON_5L: 5,
  BIDON_10L: 10,
  BIDON_25L: 25,
  BONBONNE_19L: 19,
};

/** Rendement de production : 1 litre embouteillé mobilise 1,25 litre d'eau (lavage, rinçage). */
const PRODUCTION_YIELD_FACTOR = 1.25;
/** Consommation électrique moyenne du process de traitement et d'embouteillage. */
const ENERGY_KWH_PER_LITRE = 0.18;
/** Profondeur d'analyse du tableau de bord et du calcul : 12 mois glissants. */
const ROLLING_MONTHS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function startOfMonth(date: Date): Date {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
}

/** Borne supérieure exclusive pour filtrer une colonne horodatée sur un jour inclus. */
function nextDay(date: Date): Date {
  return new Date(date.getTime() + DAY_MS);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthBuckets(start: Date, end: Date): Array<{ key: string; start: Date; end: Date }> {
  const buckets: Array<{ key: string; start: Date; end: Date }> = [];
  let cursor = startOfMonth(start);
  const last = startOfMonth(end);
  while (cursor <= last) {
    buckets.push({ key: monthKey(cursor), start: cursor, end: endOfMonth(cursor) });
    cursor = utcDay(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
  }
  return buckets;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseDay(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface TourFootprint {
  id: string;
  tourNumber: string;
  zone: string;
  date: Date;
  vehicleLabel: string;
  distanceKm: number;
  co2Kg: number;
  deliveryCount: number;
}

@Injectable()
export class EsgService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Tableau de bord consolidé sur les 12 derniers mois glissants (EF-ESG-02). */
  getDashboard(): Promise<EsgDashboard> {
    const { start, end } = this.rollingPeriod();
    return this.buildDashboard(start, end);
  }

  getIndicators(scope?: string) {
    if (scope !== undefined && scope !== EsgScope.TOURNEE && scope !== EsgScope.SITE) {
      throw new BadRequestException("La portée demandée doit valoir 'TOURNEE' ou 'SITE'.");
    }
    return this.prisma.esgIndicator.findMany({
      where: scope ? { scope: scope as EsgScope } : {},
      take: 200,
      orderBy: { periodStart: 'desc' },
      include: { tour: { select: { tourNumber: true, zone: true } } },
    });
  }

  /**
   * Recalcule les indicateurs des 12 derniers mois (EF-ESG-01, EF-ESG-02). Idempotent :
   * les indicateurs déjà présents sur les portées et périodes recalculées sont supprimés
   * avant recréation.
   */
  async compute(): Promise<{ generated: number }> {
    const { start, end } = this.rollingPeriod();
    const footprints = await this.loadTourFootprints(start, end);
    const buckets = monthBuckets(start, end);
    let generated = 0;

    const tourIds = footprints.map((footprint) => footprint.id);
    if (tourIds.length > 0) {
      await this.prisma.esgIndicator.deleteMany({
        where: { scope: EsgScope.TOURNEE, tourId: { in: tourIds } },
      });
      const created = await this.prisma.esgIndicator.createMany({
        data: footprints.map((footprint) => ({
          scope: EsgScope.TOURNEE,
          periodStart: footprint.date,
          periodEnd: footprint.date,
          tourId: footprint.id,
          distanceKm: round(footprint.distanceKm, 3),
          co2Kg: round(footprint.co2Kg, 3),
        })),
      });
      generated += created.count;
    }

    await this.prisma.esgIndicator.deleteMany({
      where: {
        scope: EsgScope.SITE,
        periodStart: { gte: buckets[0].start, lte: buckets[buckets.length - 1].start },
      },
    });
    for (const bucket of buckets) {
      const monthly = footprints.filter((footprint) => monthKey(footprint.date) === bucket.key);
      const production = await this.productionFootprint(bucket.start, bucket.end);
      const reusePct = await this.packagingReusePct(bucket.end);
      await this.prisma.esgIndicator.create({
        data: {
          scope: EsgScope.SITE,
          periodStart: bucket.start,
          periodEnd: bucket.end,
          distanceKm: round(this.sum(monthly, (item) => item.distanceKm), 3),
          co2Kg: round(this.sum(monthly, (item) => item.co2Kg), 3),
          waterM3: round(production.waterM3, 3),
          energyKwh: round(production.energyKwh, 3),
          reusePct: round(reusePct),
        },
      });
      generated += 1;
    }

    await this.notifications.notifyRoles([UserRole.RESP_DURABILITE, UserRole.DG, UserRole.ADMIN], {
      title: 'Indicateurs ESG recalculés',
      message: `${generated} indicateur(s) de durabilité ont été recalculés sur les ${ROLLING_MONTHS} derniers mois.`,
      type: NotificationType.INFO,
      category: NotificationCategory.ESG,
      link: '/esg',
    });
    return { generated };
  }

  /** Rapport de durabilité exportable, une ligne par tournée de la période (EF-ESG-03). */
  async getReport(periodStart?: string, periodEnd?: string): Promise<EsgReport> {
    const start = parseDay(periodStart);
    const end = parseDay(periodEnd);
    if (!start || !end) {
      throw new BadRequestException(
        'Les paramètres periodStart et periodEnd sont obligatoires au format AAAA-MM-JJ.',
      );
    }
    if (start > end) {
      throw new BadRequestException('La date de début doit précéder la date de fin.');
    }
    const [summary, footprints] = await Promise.all([
      this.buildDashboard(start, end),
      this.loadTourFootprints(start, end),
    ]);
    return {
      periodStart: isoDay(start),
      periodEnd: isoDay(end),
      generatedAt: new Date().toISOString(),
      summary,
      rows: footprints.map((footprint) => ({
        Tournée: footprint.tourNumber,
        Zone: footprint.zone,
        Date: isoDay(footprint.date),
        Véhicule: footprint.vehicleLabel,
        'Distance (km)': round(footprint.distanceKm),
        'CO2 (kg)': round(footprint.co2Kg),
        Livraisons: footprint.deliveryCount,
      })),
    };
  }

  private async buildDashboard(start: Date, end: Date): Promise<EsgDashboard> {
    const [footprints, production, reusePct] = await Promise.all([
      this.loadTourFootprints(start, end),
      this.productionFootprint(start, end),
      this.packagingReusePct(end),
    ]);
    const totalDistanceKm = this.sum(footprints, (item) => item.distanceKm);
    const totalCo2Kg = this.sum(footprints, (item) => item.co2Kg);
    const deliveryCount = this.sum(footprints, (item) => item.deliveryCount);
    const buckets = monthBuckets(start, end);

    const monthlyTrend = buckets.map((bucket) => {
      const monthly = footprints.filter((footprint) => monthKey(footprint.date) === bucket.key);
      return {
        month: bucket.key,
        co2Kg: round(this.sum(monthly, (item) => item.co2Kg)),
        distanceKm: round(this.sum(monthly, (item) => item.distanceKm)),
      };
    });

    // Tournées les plus émettrices du dernier mois de la période (mois courant sur le tableau de bord).
    const lastMonthKey = buckets[buckets.length - 1].key;
    const topTours = footprints
      .filter((footprint) => monthKey(footprint.date) === lastMonthKey)
      .sort((a, b) => b.co2Kg - a.co2Kg)
      .slice(0, 5)
      .map((footprint) => ({
        tourNumber: footprint.tourNumber,
        zone: footprint.zone,
        co2Kg: round(footprint.co2Kg),
        distanceKm: round(footprint.distanceKm),
      }));

    return {
      periodStart: isoDay(start),
      periodEnd: isoDay(end),
      totalCo2Kg: round(totalCo2Kg),
      totalDistanceKm: round(totalDistanceKm),
      co2PerDeliveryKg: deliveryCount > 0 ? round(totalCo2Kg / deliveryCount, 3) : 0,
      waterM3: round(production.waterM3),
      energyKwh: round(production.energyKwh),
      reusePct: round(reusePct),
      monthlyTrend,
      topTours,
    };
  }

  /**
   * Empreinte de chaque tournée terminée de la période (EF-ESG-01) : distance × facteur
   * d'émission du véhicule. La distance retenue est celle réellement mesurée sur
   * l'itinéraire optimisé, à défaut la distance optimisée, à défaut le trajet reconstitué
   * depuis le dépôt et les livraisons géolocalisées.
   */
  private async loadTourFootprints(start: Date, end: Date): Promise<TourFootprint[]> {
    const tours = await this.prisma.tour.findMany({
      where: { status: TourStatus.TERMINEE, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        tourNumber: true,
        zone: true,
        date: true,
        vehicle: { select: { plate: true, name: true, co2FactorKgPerKm: true } },
        optimizedRoutes: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: { totalDistanceKm: true, actualDistanceKm: true },
        },
        deliveries: {
          orderBy: [{ deliveredAt: 'asc' }, { createdAt: 'asc' }],
          select: { latitude: true, longitude: true },
        },
      },
    });

    return tours.map((tour) => {
      const route = tour.optimizedRoutes[0];
      const measured = tour.deliveries
        .filter((delivery) => delivery.latitude !== null && delivery.longitude !== null)
        .map((delivery) => ({
          latitude: delivery.latitude as number,
          longitude: delivery.longitude as number,
        }));
      const distanceKm =
        route?.actualDistanceKm ?? route?.totalDistanceKm ?? pathDistanceKm(measured);
      return {
        id: tour.id,
        tourNumber: tour.tourNumber,
        zone: tour.zone,
        date: tour.date,
        vehicleLabel: `${tour.vehicle.name} (${tour.vehicle.plate})`,
        distanceKm,
        co2Kg: distanceKm * tour.vehicle.co2FactorKgPerKm,
        deliveryCount: tour.deliveries.length,
      };
    });
  }

  /**
   * Eau et énergie de production déduites des ordres de fabrication de la période
   * (EF-ESG-02) : volume embouteillé × rendement de production, puis consommation
   * électrique par litre traité.
   */
  private async productionFootprint(start: Date, end: Date) {
    const upperBound = nextDay(end);
    const orders = await this.prisma.productionOrder.findMany({
      where: {
        OR: [
          { completedAt: { gte: start, lt: upperBound } },
          { completedAt: null, createdAt: { gte: start, lt: upperBound } },
        ],
      },
      select: { productFormat: true, producedQty: true },
    });
    const litres = orders.reduce(
      (total, order) => total + order.producedQty * LITRES_PER_FORMAT[order.productFormat],
      0,
    );
    return {
      waterM3: (litres * PRODUCTION_YIELD_FACTOR) / 1000,
      energyKwh: litres * ENERGY_KWH_PER_LITRE,
    };
  }

  /**
   * Taux de réemploi des emballages (EF-ESG-02) : part des unités déjà réemployées,
   * pondérée par le nombre de rotations effectuées rapporté au maximum autorisé.
   */
  private async packagingReusePct(asOf: Date): Promise<number> {
    const units = await this.prisma.packagingUnit.findMany({
      where: { createdAt: { lt: nextDay(asOf) } },
      select: { rotationCount: true, maxRotations: true },
    });
    if (units.length === 0) return 0;
    const weighted = units.reduce((total, unit) => {
      if (unit.rotationCount <= 0 || unit.maxRotations <= 0) return total;
      return total + Math.min(unit.rotationCount / unit.maxRotations, 1);
    }, 0);
    return (weighted / units.length) * 100;
  }

  /** Période analysée : du premier jour du mois, 11 mois en arrière, jusqu'à aujourd'hui. */
  private rollingPeriod(): { start: Date; end: Date } {
    const today = new Date();
    return {
      start: utcDay(today.getUTCFullYear(), today.getUTCMonth() - (ROLLING_MONTHS - 1), 1),
      end: utcDay(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    };
  }

  private sum<T>(items: T[], pick: (item: T) => number): number {
    return items.reduce((total, item) => total + pick(item), 0);
  }
}
