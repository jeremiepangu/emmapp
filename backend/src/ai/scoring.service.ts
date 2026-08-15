import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { ExplanationFactor, clamp, mean, normalizeWeights, round4 } from './ai.types';

export interface CreditScore {
  clientId: string;
  clientName: string;
  score: number;
  rating: 'A' | 'B' | 'C' | 'D';
  recommendedLimit: number;
  creditAllowed: boolean;
  factors: ExplanationFactor[];
}

export interface Recommendation {
  productId?: string;
  title: string;
  detail: string;
  suggestedQty?: number;
  factors: ExplanationFactor[];
}

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  async creditScore(clientId: string): Promise<CreditScore> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { payments: true, orders: { include: { lines: true } }, consignes: true },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    const paid = client.payments.reduce((s, p) => s + Number(p.amount), 0);
    const ordered = client.orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const paymentRatio = ordered > 0 ? clamp(paid / ordered, 0, 1.2) : 0.5;
    const creditLimit = Number(client.creditLimit);
    const creditBalance = Number(client.creditBalance);
    const utilisation = creditLimit > 0 ? clamp(creditBalance / creditLimit, 0, 1.5) : 0;
    const consigneDiscipline = client.consigneLimit > 0
      ? clamp(1 - client.consigneBalance / client.consigneLimit, 0, 1)
      : 0.5;
    const ageDays = Math.max(1, (Date.now() - client.createdAt.getTime()) / 86_400_000);
    const seniority = clamp(ageDays / 365, 0, 1);
    const volume = clamp(ordered / 1_000_000, 0, 1);

    const raw = [
      paymentRatio * 40,
      (1 - utilisation) * 25,
      consigneDiscipline * 15,
      seniority * 10,
      volume * 10,
    ];
    const score = Math.round(clamp(raw.reduce((s, n) => s + n, 0), 0, 100));
    const rating: CreditScore['rating'] = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
    const weights = normalizeWeights(raw);
    const factors: ExplanationFactor[] = [
      { label: 'Part réglée', weight: weights[0], detail: `${Math.round(paymentRatio * 100)} % des commandes encaissées` },
      { label: 'Utilisation du crédit', weight: weights[1], detail: `${Math.round(utilisation * 100)} % du plafond` },
      { label: 'Discipline de consigne', weight: weights[2], detail: `${client.consigneBalance} / ${client.consigneLimit}` },
      { label: 'Ancienneté', weight: weights[3], detail: `${Math.round(ageDays)} jours` },
      { label: 'Volume commandé', weight: weights[4], detail: `${ordered.toLocaleString('fr-FR')} CDF` },
    ];

    const recommendedLimit = Math.round((creditLimit || 100000) * (score / 70));
    return {
      clientId: client.id,
      clientName: client.name,
      score,
      rating,
      recommendedLimit,
      creditAllowed: rating !== 'D',
      factors,
    };
  }

  async recommendations(clientId: string): Promise<Recommendation[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { orders: { include: { lines: { include: { product: true } } } } },
    });
    if (!client) throw new NotFoundException('Client introuvable');

    const qtyByProduct = new Map<string, { name: string; qty: number; productId: string }>();
    for (const order of client.orders.filter((o) => o.status !== OrderStatus.ANNULEE)) {
      for (const line of order.lines) {
        const current = qtyByProduct.get(line.productId) ?? { name: line.product.name, qty: 0, productId: line.productId };
        current.qty += line.quantity;
        qtyByProduct.set(line.productId, current);
      }
    }

    const top = [...qtyByProduct.values()].sort((a, b) => b.qty - a.qty)[0];
    const catalog = await this.prisma.product.findMany({ where: { isActive: true } });
    const neverOrdered = catalog.find((p) => !qtyByProduct.has(p.id));
    const forecast = await this.prisma.demandForecast.findFirst({
      where: { zone: client.zone ?? undefined },
      orderBy: { horizonDate: 'asc' },
    });

    const result: Recommendation[] = [];
    if (top) {
      const avg = mean([...qtyByProduct.values()].map((x) => x.qty)) || top.qty;
      result.push({
        productId: top.productId,
        title: `Renouveler ${top.name}`,
        detail: `Produit le plus commandé par ${client.name} (${top.qty} unités cumulées).`,
        suggestedQty: Math.max(1, Math.round(avg)),
        factors: [{ label: 'Historique client', weight: 1, detail: `${top.qty} unités` }],
      });
    }
    if (neverOrdered) {
      result.push({
        productId: neverOrdered.id,
        title: `Proposer ${neverOrdered.name}`,
        detail: `Produit du catalogue jamais commandé par ce client, courant dans le segment ${client.segment}.`,
        suggestedQty: 6,
        factors: [{ label: 'Couverture catalogue', weight: 1, detail: `segment ${client.segment}` }],
      });
    }
    if (forecast) {
      result.push({
        productId: forecast.productId,
        title: 'Ajuster le volume de la zone',
        detail: `La prévision de ${forecast.zone} indique ${forecast.forecastQty} unités au ${forecast.horizonDate.toISOString().slice(0, 10)}.`,
        suggestedQty: forecast.forecastQty,
        factors: ((forecast.factors as unknown) as ExplanationFactor[]) ?? [{ label: 'Prévision de zone', weight: 1 }],
      });
    }
    result.push({
      title: `Offre fidélité ${client.loyaltyTier}`,
      detail: client.loyaltyTier === 'OR'
        ? 'Proposer un échange de points et un volume bonus.'
        : 'Inciter à gravir le palier supérieur par un volume additionnel.',
      factors: [{ label: 'Niveau de fidélité', weight: 1, detail: `${client.loyaltyPoints} points` }],
    });
    void PaymentMethod;
    return result;
  }
}
