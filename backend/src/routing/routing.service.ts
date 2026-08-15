import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientSegment,
  NotificationCategory,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Point de passage d'un itinéraire optimisé, tel que figé par le contrat d'API. */
export interface RouteStop extends GeoPoint {
  order: number;
  clientId: string;
  clientName: string;
  priority: number;
}

/** Dépôt EMMAPURE, centre de Kinshasa : origine fixe de toute tournée. */
export const DEPOT: GeoPoint = { latitude: -4.325, longitude: 15.322 };

const EARTH_RADIUS_KM = 6371;

/** Vitesse moyenne retenue en circulation urbaine kinoise. */
const URBAN_SPEED_KMH = 25;
/** Temps d'arrêt moyen chez un client : déchargement, consigne, encaissement. */
const STOP_DURATION_MIN = 8;
/** Trafic estimé : majoration de la durée de conduite en heures de pointe puis hors pointe. */
const PEAK_TRAFFIC_FACTOR = 1.4;
const OFF_PEAK_TRAFFIC_FACTOR = 1.1;
/** Créneaux de pointe kinois, bornes de fin exclues. */
const PEAK_WINDOWS: Array<[number, number]> = [
  [7, 9],
  [16, 18],
];
/** Heure de départ retenue tant que la tournée n'a pas démarré. */
const DEFAULT_DEPARTURE_HOUR = 8;

/** Rang de priorité par segment : 1 = servi en premier, 5 = servi en dernier. */
const SEGMENT_PRIORITY: Record<ClientSegment, number> = {
  ENTREPRISE: 1,
  HOTEL_RESTAURANT: 1,
  SUPERMARCHE: 2,
  DETAILLANT: 3,
  BOUTIQUE: 4,
  PARTICULIER: 5,
};
const BEST_PRIORITY = 1;
const WORST_PRIORITY = 5;
/** Montant cumulé des commandes à partir duquel le client gagne un rang de priorité. */
const HIGH_VALUE_ORDER_AMOUNT = 500;
/** Majoration du coût de trajet par rang de priorité perdu, lors du choix du voisin. */
const PRIORITY_COST_STEP = 0.25;
/** Pénalité en kilomètres équivalents par rang de retard imposé à un client prioritaire. */
const PRIORITY_DELAY_PENALTY_KM = 0.2;
/** Borne le raffinement 2-opt pour garantir un temps de réponse constant. */
const MAX_TWO_OPT_PASSES = 40;

const ALGORITHM_LABEL = 'plus-proche-voisin + 2-opt (priorités segment, trafic horaire)';
const MODEL_NAME = 'optimisation-itineraires';
const MODEL_VERSION = 'v1';

const ROUTE_INCLUDE = {
  tour: { select: { tourNumber: true, zone: true, date: true, status: true } },
} satisfies Prisma.OptimizedRouteInclude;

/** Distance orthodromique entre deux points (formule de haversine), en kilomètres. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Longueur du trajet ouvert dépôt → points, dans l'ordre fourni. */
export function pathDistanceKm(points: GeoPoint[]): number {
  let total = 0;
  let current: GeoPoint = DEPOT;
  for (const point of points) {
    total += haversineKm(current, point);
    current = point;
  }
  return total;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

type Waypoint = Omit<RouteStop, 'order'>;

/** Priorité client : rang du segment avancé d'un cran par les commandes de fort montant. */
function clientPriority(segment: ClientSegment, orderedAmount: number): number {
  const rank = SEGMENT_PRIORITY[segment] ?? WORST_PRIORITY;
  const bonus = orderedAmount >= HIGH_VALUE_ORDER_AMOUNT ? 1 : 0;
  return Math.max(BEST_PRIORITY, rank - bonus);
}

/** Coût de trajet pondéré : plus la priorité est basse, plus le kilomètre est « cher ». */
function priorityWeight(priority: number): number {
  return 1 + PRIORITY_COST_STEP * (priority - BEST_PRIORITY);
}

/**
 * Objectif minimisé : distance réelle plus une pénalité en kilomètres équivalents
 * proportionnelle au rang de retard des clients prioritaires. Un client prioritaire
 * repoussé en fin de tournée renchérit donc la solution.
 */
function routeCostKm(sequence: Waypoint[]): number {
  let cost = pathDistanceKm(sequence);
  for (let index = 0; index < sequence.length; index += 1) {
    const urgency = WORST_PRIORITY - sequence[index].priority;
    cost += index * urgency * PRIORITY_DELAY_PENALTY_KM;
  }
  return cost;
}

function trafficFactor(reference: Date): number {
  const hour = reference.getHours();
  const inPeak = PEAK_WINDOWS.some(([from, to]) => hour >= from && hour < to);
  return inPeak ? PEAK_TRAFFIC_FACTOR : OFF_PEAK_TRAFFIC_FACTOR;
}

function estimateDurationMin(distanceKm: number, stopCount: number, reference: Date): number {
  const drivingMin = (distanceKm / URBAN_SPEED_KMH) * 60 * trafficFactor(reference);
  return Math.round(drivingMin + stopCount * STOP_DURATION_MIN);
}

function departureReference(startedAt: Date | null): Date {
  if (startedAt) return startedAt;
  const reference = new Date();
  reference.setHours(DEFAULT_DEPARTURE_HOUR, 0, 0, 0);
  return reference;
}

/** Plus proche voisin depuis le dépôt, distance pondérée par la priorité client. */
function nearestNeighbour(points: Waypoint[]): Waypoint[] {
  const remaining = [...points];
  const sequence: Waypoint[] = [];
  let current: GeoPoint = DEPOT;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const cost = haversineKm(current, remaining[i]) * priorityWeight(remaining[i].priority);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    const [chosen] = remaining.splice(bestIndex, 1);
    sequence.push(chosen);
    current = chosen;
  }
  return sequence;
}

/** Raffinement 2-opt borné : inversion des segments qui réduisent le coût pondéré. */
function twoOpt(sequence: Waypoint[]): Waypoint[] {
  let route = [...sequence];
  let bestCost = routeCostKm(route);
  for (let pass = 0; pass < MAX_TWO_OPT_PASSES; pass += 1) {
    let improved = false;
    for (let i = 0; i < route.length - 1; i += 1) {
      for (let j = i + 1; j < route.length; j += 1) {
        const candidate = [
          ...route.slice(0, i),
          ...route.slice(i, j + 1).reverse(),
          ...route.slice(j + 1),
        ];
        const candidateCost = routeCostKm(candidate);
        if (candidateCost < bestCost - 1e-9) {
          route = candidate;
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return route;
}

@Injectable()
export class RoutingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Les 100 derniers itinéraires calculés, toutes tournées confondues. */
  listRoutes() {
    return this.prisma.optimizedRoute.findMany({
      take: 100,
      orderBy: { generatedAt: 'desc' },
      include: ROUTE_INCLUDE,
    });
  }

  /** Itinéraire le plus récent d'une tournée, null tant qu'aucun calcul n'a été lancé. */
  findForTour(tourId: string) {
    return this.prisma.optimizedRoute.findFirst({
      where: { tourId },
      orderBy: { generatedAt: 'desc' },
      include: ROUTE_INCLUDE,
    });
  }

  /**
   * Calcule l'ordre de passage optimisé (EF-OPT-01). Les clients dépourvus de coordonnées
   * sont écartés : distance et durée ne portent que sur les points géolocalisés. Le gain
   * obtenu face à l'ordre initial des commandes est journalisé dans ModelRun (OBJ-14).
   */
  async compute(tourId: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        startedAt: true,
        orders: {
          orderBy: { createdAt: 'asc' },
          select: {
            totalAmount: true,
            client: {
              select: {
                id: true,
                name: true,
                segment: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    });
    if (!tour) throw new NotFoundException('Tournée introuvable.');

    // Points de passage = clients géolocalisés des commandes rattachées, dédoublonnés ;
    // les montants d'un même client se cumulent pour établir sa priorité.
    const amounts = new Map<string, number>();
    const waypoints = new Map<string, Waypoint>();
    let ignoredClients = 0;
    for (const order of tour.orders) {
      const client = order.client;
      if (client.latitude === null || client.longitude === null) {
        ignoredClients += 1;
        continue;
      }
      const amount = (amounts.get(client.id) ?? 0) + Number(order.totalAmount);
      amounts.set(client.id, amount);
      waypoints.set(client.id, {
        clientId: client.id,
        clientName: client.name,
        latitude: client.latitude,
        longitude: client.longitude,
        priority: clientPriority(client.segment, amount),
      });
    }

    const initialOrder = [...waypoints.values()];
    const sequence = initialOrder.length > 0 ? twoOpt(nearestNeighbour(initialOrder)) : [];
    const stops: RouteStop[] = sequence.map((point, index) => ({ order: index + 1, ...point }));
    const naiveDistanceKm = pathDistanceKm(initialOrder);
    const totalDistanceKm = pathDistanceKm(sequence);
    const reference = departureReference(tour.startedAt);

    await this.prisma.modelRun.create({
      data: {
        modelName: MODEL_NAME,
        modelVersion: MODEL_VERSION,
        samples: stops.length,
        metrics: {
          tourId,
          naiveDistanceKm: round(naiveDistanceKm, 3),
          optimizedDistanceKm: round(totalDistanceKm, 3),
          gainPct:
            naiveDistanceKm > 0
              ? round(((naiveDistanceKm - totalDistanceKm) / naiveDistanceKm) * 100, 2)
              : 0,
          ignoredClients,
          algorithm: ALGORITHM_LABEL,
        },
      },
    });

    // Un nouveau calcul remplace la proposition non encore validée.
    await this.prisma.optimizedRoute.deleteMany({ where: { tourId, appliedAt: null } });
    return this.prisma.optimizedRoute.create({
      data: {
        tourId,
        stops: stops as unknown as Prisma.InputJsonValue,
        totalDistanceKm: round(totalDistanceKm, 3),
        estimatedDurationMin: estimateDurationMin(totalDistanceKm, stops.length, reference),
        algorithm: ALGORITHM_LABEL,
      },
      include: ROUTE_INCLUDE,
    });
  }

  /** Ajustement manuel de l'ordre de passage avant validation (EF-OPT-02). */
  async adjust(tourId: string, stops: RouteStop[]) {
    const route = await this.prisma.optimizedRoute.findFirst({
      where: { tourId },
      orderBy: { generatedAt: 'desc' },
    });
    if (!route) {
      throw new NotFoundException('Aucun itinéraire optimisé à ajuster pour cette tournée.');
    }
    if (route.appliedAt) {
      throw new BadRequestException("Cet itinéraire est validé : il n'est plus modifiable.");
    }

    // Coordonnées et priorités de référence conservées : seul l'ordre vient du client.
    const known = new Map(this.parseStops(route.stops).map((stop) => [stop.clientId, stop]));
    const sequence: Waypoint[] = (Array.isArray(stops) ? stops : [])
      .filter((stop) => stop && typeof stop.clientId === 'string')
      .map((stop) => {
        const reference = known.get(stop.clientId);
        return {
          clientId: stop.clientId,
          clientName: reference?.clientName ?? String(stop.clientName ?? ''),
          latitude: Number(reference?.latitude ?? stop.latitude),
          longitude: Number(reference?.longitude ?? stop.longitude),
          priority: Number(reference?.priority ?? stop.priority ?? WORST_PRIORITY),
        };
      })
      .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude));
    if (sequence.length === 0) {
      throw new BadRequestException(
        'La liste des points de passage géolocalisés est obligatoire.',
      );
    }

    const adjusted: RouteStop[] = sequence.map((stop, index) => ({ order: index + 1, ...stop }));
    const totalDistanceKm = pathDistanceKm(sequence);
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { startedAt: true },
    });

    return this.prisma.optimizedRoute.update({
      where: { id: route.id },
      data: {
        stops: adjusted as unknown as Prisma.InputJsonValue,
        totalDistanceKm: round(totalDistanceKm, 3),
        estimatedDurationMin: estimateDurationMin(
          totalDistanceKm,
          adjusted.length,
          departureReference(tour?.startedAt ?? null),
        ),
        manuallyAdjusted: true,
      },
      include: ROUTE_INCLUDE,
    });
  }

  /** Validation de l'itinéraire : il devient la référence communiquée au livreur. */
  async apply(tourId: string) {
    const route = await this.prisma.optimizedRoute.findFirst({
      where: { tourId },
      orderBy: { generatedAt: 'desc' },
    });
    if (!route) {
      throw new NotFoundException('Aucun itinéraire optimisé à valider pour cette tournée.');
    }
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { tourNumber: true, driverId: true },
    });
    if (!tour) throw new NotFoundException('Tournée introuvable.');

    const applied = await this.prisma.optimizedRoute.update({
      where: { id: route.id },
      data: { appliedAt: route.appliedAt ?? new Date() },
      include: ROUTE_INCLUDE,
    });

    const stopCount = this.parseStops(applied.stops).length;
    const payload = {
      title: 'Itinéraire de tournée validé',
      message: `Tournée ${tour.tourNumber} : ${stopCount} arrêt(s), ${applied.totalDistanceKm.toFixed(1)} km et ${applied.estimatedDurationMin} min estimés.`,
      type: NotificationType.INFO,
      category: NotificationCategory.TOURNEE,
      link: '/routing',
    };
    await this.notifications.create({ ...payload, userId: tour.driverId });
    await this.notifications.notifyRoles(
      [UserRole.CHEF_EXPLOITATION, UserRole.CHARGE_EXPLOITATION],
      payload,
    );
    return applied;
  }

  /**
   * Écart mesuré à la clôture de la tournée (EF-OPT-03) : le trajet réellement suivi est
   * reconstitué depuis le dépôt et les livraisons géolocalisées, dans leur ordre de
   * réalisation, puis comparé à l'itinéraire validé.
   */
  async recordActualRoute(tourId: string) {
    const route = await this.prisma.optimizedRoute.findFirst({
      where: { tourId, appliedAt: { not: null } },
      orderBy: { appliedAt: 'desc' },
    });
    if (!route) return null;

    const deliveries = await this.prisma.delivery.findMany({
      where: { tourId, latitude: { not: null }, longitude: { not: null } },
      orderBy: [{ deliveredAt: 'asc' }, { createdAt: 'asc' }],
      select: { latitude: true, longitude: true },
    });
    const actualDistanceKm = pathDistanceKm(
      deliveries.map((delivery) => ({
        latitude: delivery.latitude as number,
        longitude: delivery.longitude as number,
      })),
    );
    const deviationPct =
      route.totalDistanceKm > 0
        ? ((actualDistanceKm - route.totalDistanceKm) / route.totalDistanceKm) * 100
        : 0;

    return this.prisma.optimizedRoute.update({
      where: { id: route.id },
      data: {
        actualDistanceKm: round(actualDistanceKm, 3),
        deviationPct: round(deviationPct, 2),
      },
      include: ROUTE_INCLUDE,
    });
  }

  private parseStops(value: Prisma.JsonValue): RouteStop[] {
    return Array.isArray(value) ? (value as unknown as RouteStop[]) : [];
  }
}
