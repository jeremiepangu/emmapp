import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

/** Correspondance minimale ressource → profils autorisés, d'après backoffice/src/permissions.ts. */
const READERS: Record<'clients' | 'orders' | 'production' | 'deliveries', string[]> = {
  clients: ['ADMIN', 'DG', 'CHEF_EXPLOITATION', 'LIVREUR', 'CHARGE_LIVRAISON', 'COMMERCIAL', 'DELEGUE_COMMERCIAL', 'CAISSIER', 'COMPTABLE', 'DATA_ANALYST'],
  orders: ['ADMIN', 'DG', 'CHEF_EXPLOITATION', 'CHARGE_EXPLOITATION', 'LIVREUR', 'CHARGE_LIVRAISON', 'COMMERCIAL', 'DELEGUE_COMMERCIAL', 'CAISSIER', 'COMPTABLE', 'DATA_ANALYST'],
  production: ['ADMIN', 'DG', 'CHEF_PRODUCTION', 'RESP_QUALITE', 'DATA_ANALYST', 'RESP_DURABILITE', 'SUPERVISEUR'],
  deliveries: ['ADMIN', 'DG', 'CHEF_EXPLOITATION', 'CHARGE_EXPLOITATION', 'AGENT_CHARGEUR', 'LIVREUR', 'CHARGE_LIVRAISON', 'SUPERVISEUR', 'DATA_ANALYST'],
};

const empty = { clients: [], orders: [], lots: [], deliveries: [] };

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(q: string, role: string) {
    const term = q.trim();
    if (term.length < 2) return empty;

    const can = (resource: keyof typeof READERS) =>
      role === 'ADMIN' || READERS[resource].includes(role);

    const [clients, orders, lots, deliveries] = await Promise.all([
      can('clients')
        ? this.prisma.client.findMany({
            where: {
              OR: [
                { code: { contains: term, mode: 'insensitive' } },
                { name: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
                { zone: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { id: true, code: true, name: true, zone: true },
            take: 8,
          })
        : [],
      can('orders')
        ? this.prisma.order.findMany({
            where: {
              OR: [
                { orderNumber: { contains: term, mode: 'insensitive' } },
                { client: { name: { contains: term, mode: 'insensitive' } } },
              ],
            },
            select: { id: true, orderNumber: true, status: true, client: { select: { name: true } } },
            take: 8,
          })
        : [],
      can('production')
        ? this.prisma.productionOrder.findMany({
            where: {
              OR: [
                { lotNumber: { contains: term, mode: 'insensitive' } },
                { orderNumber: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { id: true, lotNumber: true, lotStatus: true, productFormat: true },
            take: 8,
          })
        : [],
      can('deliveries')
        ? this.prisma.delivery.findMany({
            where: {
              OR: [
                { deliveryNumber: { contains: term, mode: 'insensitive' } },
                { client: { name: { contains: term, mode: 'insensitive' } } },
              ],
            },
            select: { id: true, deliveryNumber: true, status: true, client: { select: { name: true } } },
            take: 8,
          })
        : [],
    ]);

    return {
      clients,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        clientName: o.client?.name,
      })),
      lots: lots.map((l) => ({
        id: l.id,
        lotNumber: l.lotNumber,
        status: l.lotStatus,
        productFormat: l.productFormat,
      })),
      deliveries: deliveries.map((d) => ({
        id: d.id,
        deliveryNumber: d.deliveryNumber,
        status: d.status,
        clientName: d.client?.name,
      })),
    };
  }
}
