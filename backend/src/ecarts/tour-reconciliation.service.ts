import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscrepancyKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { DiscrepanciesService } from './discrepancies.service';

interface LoadedItem {
  productId: string;
  quantity: number;
}

/**
 * Les feuilles de chargement sont stockees en JSON libre. On accepte les
 * variantes de nommage rencontrees plutot que d'imposer un format unique.
 */
function parseLoadSheetItems(items: unknown): LoadedItem[] {
  if (!Array.isArray(items)) return [];
  const parsed: LoadedItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const productId = row.productId ?? row.product_id ?? row.id;
    const quantity = row.quantity ?? row.qty ?? row.qtyLoaded ?? row.qty_loaded;
    if (typeof productId !== 'string') continue;
    const value = Number(quantity);
    if (!Number.isFinite(value)) continue;
    parsed.push({ productId, quantity: value });
  }
  return parsed;
}

@Injectable()
export class TourReconciliationService {
  constructor(
    private prisma: PrismaService,
    private discrepancies: DiscrepanciesService,
  ) {}

  /**
   * Confronte les quantites chargees au depart avec ce qui a ete livre,
   * retourne, refuse ou endommage au retour du livreur.
   */
  async preview(tourId: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      include: {
        loadSheets: true,
        driver: { select: { firstName: true, lastName: true } },
        deliveries: { include: { lines: { include: { product: true } } } },
      },
    });
    if (!tour) throw new NotFoundException('Tournee introuvable');

    const loaded = new Map<string, number>();
    for (const sheet of tour.loadSheets) {
      for (const item of parseLoadSheetItems(sheet.items)) {
        loaded.set(item.productId, (loaded.get(item.productId) ?? 0) + item.quantity);
      }
    }

    const accounted = new Map<string, {
      name: string;
      delivered: number;
      returned: number;
      refused: number;
      damaged: number;
    }>();
    for (const delivery of tour.deliveries) {
      for (const line of delivery.lines) {
        const entry = accounted.get(line.productId) ?? {
          name: line.product.name,
          delivered: 0,
          returned: 0,
          refused: 0,
          damaged: 0,
        };
        entry.delivered += line.qtyDelivered;
        entry.returned += line.qtyReturned;
        entry.refused += line.qtyRefused;
        entry.damaged += line.qtyDamaged;
        accounted.set(line.productId, entry);
      }
    }

    const productIds = new Set([...loaded.keys(), ...accounted.keys()]);
    const products = await this.prisma.product.findMany({
      where: { id: { in: [...productIds] } },
      select: { id: true, name: true, code: true },
    });
    const nameById = new Map(products.map((p) => [p.id, p.name]));

    const lines = [...productIds].map((productId) => {
      const loadedQty = loaded.get(productId) ?? 0;
      const entry = accounted.get(productId);
      // Ce qui est reparti chez les clients ou revenu au depot.
      const accountedQty = (entry?.delivered ?? 0) + (entry?.refused ?? 0) + (entry?.damaged ?? 0);
      return {
        productId,
        productName: nameById.get(productId) ?? entry?.name ?? productId,
        loaded: loadedQty,
        delivered: entry?.delivered ?? 0,
        returned: entry?.returned ?? 0,
        refused: entry?.refused ?? 0,
        damaged: entry?.damaged ?? 0,
        accounted: accountedQty,
        variance: accountedQty - loadedQty,
      };
    }).sort((a, b) => a.productName.localeCompare(b.productName));

    return {
      tour: {
        id: tour.id,
        tourNumber: tour.tourNumber,
        zone: tour.zone,
        date: tour.date,
        driver: `${tour.driver.firstName} ${tour.driver.lastName}`,
      },
      hasLoadSheet: tour.loadSheets.length > 0,
      lines,
      totals: {
        loaded: lines.reduce((s, l) => s + l.loaded, 0),
        accounted: lines.reduce((s, l) => s + l.accounted, 0),
        variance: lines.reduce((s, l) => s + l.variance, 0),
      },
    };
  }

  /** Enregistre les ecarts produit par produit dans le journal. */
  async reconcile(tourId: string) {
    const result = await this.preview(tourId);
    let recorded = 0;
    for (const line of result.lines) {
      if (line.variance === 0) continue;
      const entry = await this.discrepancies.record({
        kind: DiscrepancyKind.TOURNEE,
        reference: result.tour.tourNumber,
        label: `${result.tour.tourNumber} — ${line.productName}`,
        expected: line.loaded,
        actual: line.accounted,
        tourId,
      });
      if (entry) recorded += 1;
    }
    return { ...result, recorded };
  }
}
