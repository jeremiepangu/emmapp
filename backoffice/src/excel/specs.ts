import {
  api,
  ApiKeyInfo,
  Client,
  ClientSegment,
  ConsigneMovement,
  Delivery,
  EmployeeProfile,
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceInventoryLine,
  FinanceMovement,
  LeaveRequest,
  LoyaltyClient,
  NotificationItem,
  Order,
  PackagingMovement,
  PackagingSku,
  Payment,
  PaymentMethod,
  PortalAccount,
  PricingRule,
  Product,
  ProductionOrder,
  QualityCheck,
  IotSensor,
  QuoteRequest,
  StockItem,
  StockLocation,
  StockLocationType,
  Tour,
  User,
  Vehicle,
  WebhookSubscription,
} from '../api';
import { ExcelSheet, bool, cell, num, upsertBy } from './excel';

const SEGMENTS: ClientSegment[] = ['PARTICULIER', 'BOUTIQUE', 'DETAILLANT', 'SUPERMARCHE', 'ENTREPRISE', 'HOTEL_RESTAURANT'];

function asSegment(value: string): ClientSegment {
  const raw = value.toUpperCase() as ClientSegment;
  return SEGMENTS.includes(raw) ? raw : 'DETAILLANT';
}

function asMethod(value: string): PaymentMethod {
  const raw = value.toUpperCase().replace(/\s/g, '_') as PaymentMethod;
  return raw || 'ESPECES';
}

export function sheetClients(rows: Client[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Clients',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Nom' },
      { key: 'segment', header: 'Segment' },
      { key: 'phone', header: 'Telephone' },
      { key: 'email', header: 'Email' },
      { key: 'profession', header: 'Profession' },
      { key: 'avenue', header: 'Avenue' },
      { key: 'avenueNumber', header: 'Numero' },
      { key: 'quartier', header: 'Quartier' },
      { key: 'commune', header: 'Commune' },
      { key: 'district', header: 'District' },
      { key: 'province', header: 'Province' },
      { key: 'consigneLimit', header: 'Limite consigne' },
    ],
    rows: rows.map((row) => ({
      code: row.code,
      name: row.name,
      segment: row.segment,
      phone: row.phone ?? '',
      email: row.email ?? '',
      profession: row.profession ?? '',
      avenue: row.avenue ?? '',
      avenueNumber: row.avenueNumber ?? '',
      quartier: row.quartier ?? '',
      commune: row.commune ?? '',
      district: row.district ?? '',
      province: row.province ?? '',
      consigneLimit: row.consigneLimit,
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') || !cell(row, 'name') ? 'Code et nom requis' : null),
        create: (row) => api.createClient({
          code: cell(row, 'code'),
          name: cell(row, 'name'),
          segment: asSegment(cell(row, 'segment')),
          phone: cell(row, 'phone', 'telephone') || undefined,
          email: cell(row, 'email') || undefined,
          profession: cell(row, 'profession') || undefined,
          avenue: cell(row, 'avenue') || undefined,
          avenueNumber: cell(row, 'numero', 'avenueNumber') || undefined,
          quartier: cell(row, 'quartier') || undefined,
          commune: cell(row, 'commune') || undefined,
          district: cell(row, 'district') || undefined,
          province: cell(row, 'province') || undefined,
          consigneLimit: num(row, 'consigneLimit', 'limite consigne') || undefined,
        }),
        update: (id, row) => api.updateClient(id, {
          name: cell(row, 'name') || undefined,
          segment: asSegment(cell(row, 'segment')),
          phone: cell(row, 'phone', 'telephone') || undefined,
          email: cell(row, 'email') || undefined,
          profession: cell(row, 'profession') || undefined,
          avenue: cell(row, 'avenue') || undefined,
          avenueNumber: cell(row, 'numero', 'avenueNumber') || undefined,
          quartier: cell(row, 'quartier') || undefined,
          commune: cell(row, 'commune') || undefined,
          district: cell(row, 'district') || undefined,
          province: cell(row, 'province') || undefined,
          consigneLimit: num(row, 'consigneLimit', 'limite consigne') || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetProducts(rows: Product[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Produits',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Nom' },
      { key: 'format', header: 'Format' },
      { key: 'unitPrice', header: 'Prix' },
      { key: 'consigneAmount', header: 'Vidange' },
      { key: 'isReusable', header: 'Reutilisable' },
    ],
    rows: rows.map((row) => ({
      code: row.code,
      name: row.name,
      format: row.format,
      unitPrice: Number(row.unitPrice),
      consigneAmount: Number(row.consigneAmount ?? 0),
      isReusable: row.isReusable ? 'Oui' : 'Non',
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') || !cell(row, 'name') ? 'Code et nom requis' : null),
        create: (row) => api.createProduct({
          code: cell(row, 'code'),
          name: cell(row, 'name'),
          format: cell(row, 'format') || 'BIDON_5L',
          unitPrice: num(row, 'prix', 'unitPrice'),
          consigneAmount: num(row, 'vidange', 'consigneAmount'),
          isReusable: bool(row, 'reutilisable', 'isReusable') ?? true,
        }),
        update: (id, row) => api.updateProduct(id, {
          name: cell(row, 'name') || undefined,
          format: cell(row, 'format') || undefined,
          unitPrice: num(row, 'prix', 'unitPrice') || undefined,
          consigneAmount: num(row, 'vidange', 'consigneAmount') || undefined,
          isReusable: bool(row, 'reutilisable', 'isReusable'),
        }),
      })
      : undefined,
  };
}

export function sheetVehicles(rows: Vehicle[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Vehicules',
    columns: [
      { key: 'plate', header: 'Plaque' },
      { key: 'name', header: 'Nom' },
      { key: 'capacity', header: 'Capacite' },
      { key: 'fuelType', header: 'Carburant' },
      { key: 'co2FactorKgPerKm', header: 'CO2 km' },
    ],
    rows: rows.map((row) => ({
      plate: row.plate,
      name: row.name,
      capacity: row.capacity,
      fuelType: row.fuelType ?? '',
      co2FactorKgPerKm: row.co2FactorKgPerKm ?? '',
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'plaque', 'plate'),
        findId: (key) => rows.find((row) => row.plate.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'plaque', 'plate') || !cell(row, 'nom', 'name') ? 'Plaque et nom requis' : null),
        create: (row) => api.createVehicle({
          plate: cell(row, 'plaque', 'plate'),
          name: cell(row, 'nom', 'name'),
          capacity: num(row, 'capacite', 'capacity') || undefined,
          fuelType: cell(row, 'carburant', 'fuelType') || undefined,
          co2FactorKgPerKm: num(row, 'co2 km', 'co2FactorKgPerKm') || undefined,
        }),
        update: (id, row) => api.updateVehicle(id, {
          name: cell(row, 'nom', 'name') || undefined,
          capacity: num(row, 'capacite', 'capacity') || undefined,
          fuelType: cell(row, 'carburant', 'fuelType') || undefined,
          co2FactorKgPerKm: num(row, 'co2 km', 'co2FactorKgPerKm') || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetUsers(rows: User[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Utilisateurs',
    columns: [
      { key: 'email', header: 'Email' },
      { key: 'firstName', header: 'Prenom' },
      { key: 'lastName', header: 'Nom' },
      { key: 'role', header: 'Profil' },
      { key: 'phone', header: 'Telephone' },
      { key: 'password', header: 'Mot de passe' },
      { key: 'isActive', header: 'Actif' },
    ],
    rows: rows.map((row) => ({
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      phone: row.phone ?? '',
      password: '',
      isActive: row.isActive === false ? 'Non' : 'Oui',
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'email'),
        findId: (key) => rows.find((row) => row.email.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'email') || !cell(row, 'prenom', 'firstName') || !cell(row, 'nom', 'lastName') ? 'Email, prenom et nom requis' : null),
        create: (row) => api.createUser({
          email: cell(row, 'email'),
          password: cell(row, 'mot de passe', 'password') || 'password123',
          firstName: cell(row, 'prenom', 'firstName'),
          lastName: cell(row, 'nom', 'lastName'),
          phone: cell(row, 'telephone', 'phone') || undefined,
          role: cell(row, 'profil', 'role') || 'COMMERCIAL',
        }),
        update: (id, row) => api.updateUser(id, {
          firstName: cell(row, 'prenom', 'firstName') || undefined,
          lastName: cell(row, 'nom', 'lastName') || undefined,
          phone: cell(row, 'telephone', 'phone') || undefined,
          role: cell(row, 'profil', 'role') || undefined,
          password: cell(row, 'mot de passe', 'password') || undefined,
          isActive: bool(row, 'actif', 'isActive'),
        }),
      })
      : undefined,
  };
}

export function sheetPayments(rows: Payment[], clients: Client[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Paiements',
    columns: [
      { key: 'date', header: 'Date' },
      { key: 'clientCode', header: 'Code client' },
      { key: 'clientName', header: 'Client' },
      { key: 'amount', header: 'Montant' },
      { key: 'method', header: 'Mode' },
      { key: 'reference', header: 'Reference' },
    ],
    rows: rows.map((row) => ({
      date: new Date(row.createdAt).toISOString().slice(0, 10),
      clientCode: clients.find((client) => client.id === row.clientId)?.code ?? '',
      clientName: row.client?.name ?? '',
      amount: Number(row.amount),
      method: row.method,
      reference: row.reference ?? '',
    })),
    importRows: canWrite
      ? async (imported) => {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
        for (const [index, row] of imported.entries()) {
          const amount = num(row, 'montant', 'amount');
          const code = cell(row, 'code client', 'clientCode');
          const name = cell(row, 'client', 'clientName');
          const client = clients.find((item) => item.code.toLowerCase() === code.toLowerCase())
            ?? clients.find((item) => item.name.toLowerCase() === name.toLowerCase());
          if (!amount || !client) {
            result.errors.push(`Ligne ${index + 2}: client ou montant manquant`);
            result.skipped += 1;
            continue;
          }
          try {
            await api.createPayment({
              clientId: client.id,
              amount,
              method: asMethod(cell(row, 'mode', 'method')),
              reference: cell(row, 'reference') || undefined,
            });
            result.created += 1;
          } catch (error) {
            result.errors.push(`Ligne ${index + 2}: ${error instanceof Error ? error.message : 'echec'}`);
          }
        }
        return result;
      }
      : undefined,
  };
}

export function sheetPricing(rows: PricingRule[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Tarifs',
    columns: [
      { key: 'name', header: 'Nom' },
      { key: 'type', header: 'Type' },
      { key: 'value', header: 'Valeur' },
      { key: 'minQuantity', header: 'Qte min' },
      { key: 'maxQuantity', header: 'Qte max' },
      { key: 'stepQuantity', header: 'Palier' },
      { key: 'segment', header: 'Segment' },
      { key: 'zone', header: 'Zone' },
      { key: 'productCode', header: 'Produit' },
      { key: 'priority', header: 'Priorite' },
      { key: 'isActive', header: 'Actif' },
    ],
    rows: rows.map((row) => ({
      name: row.name,
      type: row.type,
      value: Number(row.value),
      minQuantity: row.minQuantity,
      maxQuantity: row.maxQuantity ?? '',
      stepQuantity: row.stepQuantity ?? '',
      segment: row.segment ?? '',
      zone: row.zone ?? '',
      productCode: row.product?.code ?? '',
      priority: row.priority,
      isActive: row.isActive ? 'Oui' : 'Non',
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'nom', 'name'),
        findId: (key) => rows.find((row) => row.name.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'nom', 'name') ? 'Nom requis' : null),
        create: (row) => api.createPricingRule({
          name: cell(row, 'nom', 'name'),
          type: (cell(row, 'type') === 'FIXED' ? 'FIXED' : 'ARTICLE_OFFERT'),
          value: num(row, 'valeur', 'value'),
          minQuantity: num(row, 'qte min', 'minQuantity') || 1,
          maxQuantity: num(row, 'qte max', 'maxQuantity') || null,
          stepQuantity: num(row, 'palier', 'stepQuantity') || undefined,
          segment: cell(row, 'segment') ? asSegment(cell(row, 'segment')) : null,
          zone: cell(row, 'zone') || null,
          priority: num(row, 'priorite', 'priority') || 0,
          isActive: bool(row, 'actif', 'isActive') ?? true,
        }),
        update: (id, row) => api.updatePricingRule(id, {
          value: num(row, 'valeur', 'value') || undefined,
          minQuantity: num(row, 'qte min', 'minQuantity') || undefined,
          isActive: bool(row, 'actif', 'isActive'),
        }),
      })
      : undefined,
  };
}

export function sheetStockItems(items: StockItem[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Stock',
    columns: [
      { key: 'productCode', header: 'Produit' },
      { key: 'productName', header: 'Libelle' },
      { key: 'locationCode', header: 'Emplacement' },
      { key: 'quantity', header: 'Quantite' },
      { key: 'lotNumber', header: 'Lot' },
    ],
    rows: items.map((row) => ({
      productCode: row.product.code,
      productName: row.product.name,
      locationCode: row.location.code,
      quantity: row.quantity,
      lotNumber: row.lotNumber ?? '',
    })),
    importRows: canWrite
      ? async (imported) => {
        const products = await api.getProducts();
        const locations = await api.getStockLocations();
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
        for (const [index, row] of imported.entries()) {
          const product = products.find((item) => item.code.toLowerCase() === cell(row, 'produit', 'productCode').toLowerCase());
          const location = locations.find((item) => item.code.toLowerCase() === cell(row, 'emplacement', 'locationCode').toLowerCase());
          const quantity = num(row, 'quantite', 'quantity');
          if (!product || !location) {
            result.errors.push(`Ligne ${index + 2}: produit ou emplacement introuvable`);
            result.skipped += 1;
            continue;
          }
          try {
            await api.adjustStock({
              productId: product.id,
              locationId: location.id,
              quantity,
              lotNumber: cell(row, 'lot', 'lotNumber') || undefined,
            });
            result.updated += 1;
          } catch (error) {
            result.errors.push(`Ligne ${index + 2}: ${error instanceof Error ? error.message : 'echec'}`);
          }
        }
        return result;
      }
      : undefined,
  };
}

export function sheetStockLocations(rows: StockLocation[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Emplacements',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Nom' },
      { key: 'type', header: 'Type' },
    ],
    rows: rows.map((row) => ({ code: row.code, name: row.name, type: row.type })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') || !cell(row, 'nom', 'name') ? 'Code et nom requis' : null),
        create: (row) => api.createStockLocation({
          code: cell(row, 'code'),
          name: cell(row, 'nom', 'name'),
          type: (cell(row, 'type') as StockLocationType) || 'PRODUITS_FINIS',
        }),
        update: (id, row) => api.updateStockLocation(id, {
          name: cell(row, 'nom', 'name') || undefined,
          type: (cell(row, 'type') as StockLocationType) || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetOrders(rows: Order[]): ExcelSheet {
  return {
    name: 'Commandes',
    columns: [
      { key: 'orderNumber', header: 'Numero' },
      { key: 'client', header: 'Client' },
      { key: 'status', header: 'Statut' },
      { key: 'totalAmount', header: 'Montant' },
      { key: 'lines', header: 'Lignes' },
    ],
    rows: rows.map((row) => ({
      orderNumber: row.orderNumber,
      client: row.client?.name ?? '',
      status: row.status,
      totalAmount: Number(row.totalAmount),
      lines: (row.lines ?? []).map((line) => `${line.product?.name ?? line.productId} x${line.quantity}`).join(' | '),
    })),
  };
}

export function sheetDeliveries(rows: Delivery[]): ExcelSheet {
  return {
    name: 'Livraisons',
    columns: [
      { key: 'deliveryNumber', header: 'Numero' },
      { key: 'client', header: 'Client' },
      { key: 'status', header: 'Statut' },
      { key: 'deliveredAt', header: 'Date' },
    ],
    rows: rows.map((row) => ({
      deliveryNumber: row.deliveryNumber,
      client: row.client?.name ?? '',
      status: row.status,
      deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toLocaleString('fr-FR') : '',
    })),
  };
}

export function sheetTours(rows: Tour[]): ExcelSheet {
  return {
    name: 'Tournees',
    columns: [
      { key: 'tourNumber', header: 'Numero' },
      { key: 'zone', header: 'Zone' },
      { key: 'date', header: 'Date' },
      { key: 'status', header: 'Statut' },
      { key: 'driver', header: 'Chauffeur' },
      { key: 'vehicle', header: 'Vehicule' },
    ],
    rows: rows.map((row) => ({
      tourNumber: row.tourNumber,
      zone: row.zone,
      date: row.date?.slice(0, 10),
      status: row.status,
      driver: row.driver ? `${row.driver.firstName} ${row.driver.lastName}` : '',
      vehicle: row.vehicle ? `${row.vehicle.plate} ${row.vehicle.name}` : '',
    })),
  };
}

export function sheetProduction(rows: ProductionOrder[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Fabrication',
    columns: [
      { key: 'orderNumber', header: 'OF' },
      { key: 'lotNumber', header: 'Lot' },
      { key: 'productFormat', header: 'Format' },
      { key: 'lineCode', header: 'Ligne' },
      { key: 'plannedQty', header: 'Planifie' },
      { key: 'producedQty', header: 'Produit' },
      { key: 'status', header: 'Statut' },
    ],
    rows: rows.map((row) => ({
      orderNumber: row.orderNumber,
      lotNumber: row.lotNumber,
      productFormat: row.productFormat,
      lineCode: row.lineCode,
      plannedQty: row.plannedQty,
      producedQty: row.producedQty,
      status: row.status,
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'of', 'orderNumber'),
        findId: (key) => rows.find((row) => row.orderNumber === key)?.id,
        required: (row) => (!cell(row, 'format', 'productFormat') ? 'Format requis' : null),
        create: (row) => api.createProductionOrder({
          productFormat: cell(row, 'format', 'productFormat'),
          lineCode: cell(row, 'ligne', 'lineCode') || 'L1',
          plannedQty: num(row, 'planifie', 'plannedQty') || 1,
        }),
        update: (id, row) => api.updateProductionOrder(id, {
          plannedQty: num(row, 'planifie', 'plannedQty') || undefined,
          producedQty: num(row, 'produit', 'producedQty') || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetQuality(rows: QualityCheck[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Qualite',
    columns: [
      { key: 'lotNumber', header: 'Lot' },
      { key: 'ph', header: 'pH' },
      { key: 'chlorineFree', header: 'Chlore' },
      { key: 'tds', header: 'TDS' },
      { key: 'turbidity', header: 'Turbidite' },
      { key: 'microbiologyOk', header: 'Microbio OK' },
      { key: 'status', header: 'Statut' },
    ],
    rows: rows.map((row) => ({
      lotNumber: row.lotNumber,
      ph: row.ph ?? '',
      chlorineFree: row.chlorineFree ?? '',
      tds: row.tds ?? '',
      turbidity: row.turbidity ?? '',
      microbiologyOk: row.microbiologyOk ? 'Oui' : 'Non',
      status: row.status,
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'lot', 'lotNumber'),
        findId: (key) => rows.find((row) => row.lotNumber === key)?.id,
        required: (row) => (!cell(row, 'lot', 'lotNumber') ? 'Lot requis' : null),
        create: (row) => api.createQualityCheck({
          lotNumber: cell(row, 'lot', 'lotNumber'),
          ph: num(row, 'ph') || undefined,
          chlorineFree: num(row, 'chlore', 'chlorineFree') || undefined,
          tds: num(row, 'tds') || undefined,
          turbidity: num(row, 'turbidite', 'turbidity') || undefined,
          microbiologyOk: bool(row, 'microbio ok', 'microbiologyOk'),
        }),
        update: (id, row) => api.updateQualityCheck(id, {
          ph: num(row, 'ph') || undefined,
          chlorineFree: num(row, 'chlore', 'chlorineFree') || undefined,
          tds: num(row, 'tds') || undefined,
          turbidity: num(row, 'turbidite', 'turbidity') || undefined,
          microbiologyOk: bool(row, 'microbio ok', 'microbiologyOk'),
        }),
      })
      : undefined,
  };
}

export function sheetLoyalty(rows: LoyaltyClient[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Fidelite',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Client' },
      { key: 'loyaltyPoints', header: 'Points' },
      { key: 'loyaltyTier', header: 'Palier' },
      { key: 'walletBalance', header: 'Portefeuille' },
    ],
    rows: rows.map((row) => ({
      code: row.code,
      name: row.name,
      loyaltyPoints: row.loyaltyPoints,
      loyaltyTier: row.loyaltyTier,
      walletBalance: Number(row.walletBalance),
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') ? 'Code requis' : null),
        create: async () => { throw new Error('Creez le client avant d importer la fidelite'); },
        update: (id, row) => api.updateLoyalty(id, {
          loyaltyPoints: num(row, 'points', 'loyaltyPoints'),
          walletBalance: num(row, 'portefeuille', 'walletBalance'),
        }),
      })
      : undefined,
  };
}

export function sheetConsignes(rows: ConsigneMovement[], clients: Client[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Consignes',
    columns: [
      { key: 'clientCode', header: 'Code client' },
      { key: 'productFormat', header: 'Format' },
      { key: 'qtyIn', header: 'Entrees' },
      { key: 'qtyOut', header: 'Sorties' },
      { key: 'notes', header: 'Notes' },
    ],
    rows: rows.map((row) => ({
      clientCode: row.client?.code ?? '',
      productFormat: row.productFormat,
      qtyIn: row.qtyIn,
      qtyOut: row.qtyOut,
      notes: '',
    })),
    importRows: canWrite
      ? async (imported) => {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
        for (const [index, row] of imported.entries()) {
          const client = clients.find((item) => item.code.toLowerCase() === cell(row, 'code client', 'clientCode').toLowerCase());
          if (!client) {
            result.errors.push(`Ligne ${index + 2}: client introuvable`);
            result.skipped += 1;
            continue;
          }
          try {
            await api.createConsigneMovement({
              clientId: client.id,
              productFormat: cell(row, 'format', 'productFormat') || 'BIDON_5L',
              qtyIn: num(row, 'entrees', 'qtyIn'),
              qtyOut: num(row, 'sorties', 'qtyOut'),
              notes: cell(row, 'notes') || undefined,
            });
            result.created += 1;
          } catch (error) {
            result.errors.push(`Ligne ${index + 2}: ${error instanceof Error ? error.message : 'echec'}`);
          }
        }
        return result;
      }
      : undefined,
  };
}

export function sheetPackagingSkus(rows: PackagingSku[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Emballages',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Nom' },
      { key: 'kind', header: 'Type' },
      { key: 'format', header: 'Format' },
      { key: 'minStock', header: 'Stock min' },
      { key: 'quantity', header: 'Stock' },
    ],
    rows: rows.map((row) => ({
      code: row.code,
      name: row.name,
      kind: row.kind,
      format: row.format,
      minStock: row.minStock,
      quantity: row.stock?.quantity ?? 0,
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') || !cell(row, 'nom', 'name') ? 'Code et nom requis' : null),
        create: (row) => api.createPackagingSku({
          code: cell(row, 'code'),
          name: cell(row, 'nom', 'name'),
          kind: (cell(row, 'type', 'kind') as PackagingSku['kind']) || 'EMBALLAGE',
          format: (cell(row, 'format') as PackagingSku['format']) || 'BIDON_5L',
          minStock: num(row, 'stock min', 'minStock') || undefined,
        }),
        update: (id, row) => api.updatePackagingSku(id, {
          name: cell(row, 'nom', 'name') || undefined,
          minStock: num(row, 'stock min', 'minStock') || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetPackagingMovements(rows: PackagingMovement[]): ExcelSheet {
  return {
    name: 'Mouvements emballage',
    columns: [
      { key: 'date', header: 'Date' },
      { key: 'sku', header: 'Article' },
      { key: 'type', header: 'Type' },
      { key: 'quantity', header: 'Quantite' },
      { key: 'supplier', header: 'Fournisseur' },
      { key: 'reference', header: 'Reference' },
    ],
    rows: rows.map((row) => ({
      date: new Date(row.createdAt).toLocaleString('fr-FR'),
      sku: row.sku?.code ?? '',
      type: row.type,
      quantity: row.quantity,
      supplier: row.supplier ?? '',
      reference: row.reference ?? '',
    })),
  };
}

export function sheetFinanceAccounts(rows: FinanceAccount[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Comptes',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Libelle' },
      { key: 'kind', header: 'Type' },
      { key: 'openingBalance', header: 'Ouverture' },
      { key: 'balance', header: 'Solde' },
      { key: 'bankName', header: 'Banque' },
      { key: 'iban', header: 'IBAN' },
    ],
    rows: rows.map((row) => ({
      code: row.code,
      name: row.name,
      kind: row.kind,
      openingBalance: Number(row.openingBalance),
      balance: row.balance,
      bankName: row.bankName ?? '',
      iban: row.iban ?? '',
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') || !cell(row, 'libelle', 'name') ? 'Code et libelle requis' : null),
        create: (row) => api.createFinanceAccount({
          code: cell(row, 'code'),
          name: cell(row, 'libelle', 'name'),
          kind: cell(row, 'type', 'kind') === 'BANQUE' ? 'BANQUE' : 'CAISSE',
          openingBalance: num(row, 'ouverture', 'openingBalance'),
          bankName: cell(row, 'banque', 'bankName') || undefined,
          iban: cell(row, 'iban') || undefined,
        }),
        update: (id, row) => api.updateFinanceAccount(id, {
          name: cell(row, 'libelle', 'name') || undefined,
          openingBalance: num(row, 'ouverture', 'openingBalance') || undefined,
          bankName: cell(row, 'banque', 'bankName') || undefined,
          iban: cell(row, 'iban') || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetFinanceCategories(rows: FinanceCategory[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Rubriques',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Libelle' },
      { key: 'kind', header: 'Nature' },
    ],
    rows: rows.map((row) => ({ code: row.code, name: row.name, kind: row.kind })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') || !cell(row, 'libelle', 'name') ? 'Code et libelle requis' : null),
        create: (row) => api.createFinanceCategory({
          code: cell(row, 'code'),
          name: cell(row, 'libelle', 'name'),
          kind: (cell(row, 'nature', 'kind') as FinanceCategory['kind']) || 'CHARGE',
        }),
        update: async () => undefined,
      })
      : undefined,
  };
}

export function sheetFinanceMovements(rows: FinanceMovement[], accounts: FinanceAccount[], categories: FinanceCategory[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Journal',
    columns: [
      { key: 'number', header: 'Numero' },
      { key: 'date', header: 'Date' },
      { key: 'kind', header: 'Type' },
      { key: 'label', header: 'Libelle' },
      { key: 'account', header: 'Compte' },
      { key: 'amount', header: 'Montant' },
      { key: 'method', header: 'Mode' },
      { key: 'status', header: 'Statut' },
      { key: 'category', header: 'Rubrique' },
    ],
    rows: rows.map((row) => ({
      number: row.number,
      date: row.date?.slice(0, 10),
      kind: row.kind,
      label: row.label,
      account: row.account?.code ?? '',
      amount: Number(row.amount),
      method: row.method,
      status: row.status,
      category: row.category?.code ?? '',
    })),
    importRows: canWrite
      ? async (imported) => {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
        for (const [index, row] of imported.entries()) {
          const account = accounts.find((item) => item.code.toLowerCase() === cell(row, 'compte', 'account').toLowerCase());
          const category = categories.find((item) => item.code.toLowerCase() === cell(row, 'rubrique', 'category').toLowerCase());
          if (!account || !cell(row, 'libelle', 'label') || !num(row, 'montant', 'amount')) {
            result.errors.push(`Ligne ${index + 2}: compte, libelle ou montant manquant`);
            result.skipped += 1;
            continue;
          }
          try {
            await api.createFinanceMovement({
              kind: (cell(row, 'type', 'kind') as FinanceMovement['kind']) || 'ENTREE',
              accountId: account.id,
              categoryId: category?.id,
              amount: num(row, 'montant', 'amount'),
              method: asMethod(cell(row, 'mode', 'method')),
              date: cell(row, 'date') || new Date().toISOString().slice(0, 10),
              label: cell(row, 'libelle', 'label'),
              reference: cell(row, 'numero', 'number') || undefined,
            });
            result.created += 1;
          } catch (error) {
            result.errors.push(`Ligne ${index + 2}: ${error instanceof Error ? error.message : 'echec'}`);
          }
        }
        return result;
      }
      : undefined,
  };
}

export function sheetFinanceBudgets(rows: FinanceBudget[], categories: FinanceCategory[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Budget',
    columns: [
      { key: 'year', header: 'Annee' },
      { key: 'month', header: 'Mois' },
      { key: 'category', header: 'Rubrique' },
      { key: 'plannedAmount', header: 'Prevu' },
      { key: 'actualAmount', header: 'Reel' },
    ],
    rows: rows.map((row) => ({
      year: row.year,
      month: row.month ?? '',
      category: row.category?.code ?? '',
      plannedAmount: Number(row.plannedAmount),
      actualAmount: row.actualAmount ?? 0,
    })),
    importRows: canWrite
      ? async (imported) => {
        const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
        for (const [index, row] of imported.entries()) {
          const category = categories.find((item) => item.code.toLowerCase() === cell(row, 'rubrique', 'category').toLowerCase());
          if (!category) {
            result.errors.push(`Ligne ${index + 2}: rubrique introuvable`);
            result.skipped += 1;
            continue;
          }
          try {
            await api.createFinanceBudget({
              year: num(row, 'annee', 'year') || new Date().getFullYear(),
              month: num(row, 'mois', 'month') || null,
              categoryId: category.id,
              plannedAmount: num(row, 'prevu', 'plannedAmount'),
            });
            result.created += 1;
          } catch (error) {
            result.errors.push(`Ligne ${index + 2}: ${error instanceof Error ? error.message : 'echec'}`);
          }
        }
        return result;
      }
      : undefined,
  };
}

export function sheetFinanceInventory(rows: FinanceInventoryLine[]): ExcelSheet {
  return {
    name: 'Inventaire',
    columns: [
      { key: 'productCode', header: 'Produit' },
      { key: 'locationCode', header: 'Emplacement' },
      { key: 'theoreticalQty', header: 'Theorique' },
      { key: 'countedQty', header: 'Compte' },
      { key: 'unitValue', header: 'Valeur unitaire' },
    ],
    rows: rows.map((row) => ({
      productCode: row.productCode ?? row.product?.code ?? '',
      locationCode: row.locationCode ?? '',
      theoreticalQty: row.theoreticalQty,
      countedQty: row.countedQty ?? row.theoreticalQty,
      unitValue: Number(row.unitValue),
    })),
  };
}

export function sheetEmployees(rows: EmployeeProfile[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Personnel',
    columns: [
      { key: 'matricule', header: 'Matricule' },
      { key: 'name', header: 'Nom' },
      { key: 'jobTitle', header: 'Poste' },
      { key: 'department', header: 'Service' },
      { key: 'contractType', header: 'Contrat' },
      { key: 'hireDate', header: 'Embauche' },
      { key: 'baseSalary', header: 'Salaire' },
      { key: 'bankName', header: 'Banque' },
      { key: 'bankAccount', header: 'Compte bancaire' },
    ],
    rows: rows.map((row) => ({
      matricule: row.matricule ?? '',
      name: `${row.user?.firstName ?? ''} ${row.user?.lastName ?? ''}`.trim(),
      jobTitle: row.jobTitle,
      department: row.department,
      contractType: row.contractType ?? '',
      hireDate: row.hireDate?.slice(0, 10),
      baseSalary: Number(row.baseSalary),
      bankName: row.bankName ?? '',
      bankAccount: row.bankAccount ?? '',
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'matricule'),
        findId: (key) => rows.find((row) => (row.matricule ?? '').toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'poste', 'jobTitle') ? 'Poste requis pour une mise a jour' : null),
        create: async () => { throw new Error('Creez d abord le compte utilisateur, puis la fiche RH'); },
        update: (id, row) => api.updateEmployee(id, {
          jobTitle: cell(row, 'poste', 'jobTitle') || undefined,
          department: cell(row, 'service', 'department') || undefined,
          contractType: cell(row, 'contrat', 'contractType') || undefined,
          baseSalary: num(row, 'salaire', 'baseSalary') || undefined,
          bankName: cell(row, 'banque', 'bankName') || undefined,
          bankAccount: cell(row, 'compte bancaire', 'bankAccount') || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetLeaves(rows: LeaveRequest[]): ExcelSheet {
  return {
    name: 'Conges',
    columns: [
      { key: 'employee', header: 'Agent' },
      { key: 'type', header: 'Type' },
      { key: 'startDate', header: 'Debut' },
      { key: 'endDate', header: 'Fin' },
      { key: 'status', header: 'Statut' },
    ],
    rows: rows.map((row) => ({
      employee: `${row.user?.firstName ?? ''} ${row.user?.lastName ?? ''}`.trim(),
      type: row.type,
      startDate: row.startDate?.slice(0, 10),
      endDate: row.endDate?.slice(0, 10),
      status: row.status,
    })),
  };
}

export function sheetNotifications(rows: NotificationItem[]): ExcelSheet {
  return {
    name: 'Notifications',
    columns: [
      { key: 'createdAt', header: 'Date' },
      { key: 'category', header: 'Categorie' },
      { key: 'title', header: 'Titre' },
      { key: 'message', header: 'Message' },
      { key: 'read', header: 'Lu' },
    ],
    rows: rows.map((row) => ({
      createdAt: new Date(row.createdAt).toLocaleString('fr-FR'),
      category: row.category,
      title: row.title,
      message: row.message,
      read: row.read ? 'Oui' : 'Non',
    })),
  };
}

export function sheetPortalAccounts(rows: PortalAccount[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Comptes portail',
    columns: [
      { key: 'email', header: 'Email' },
      { key: 'fullName', header: 'Nom' },
      { key: 'clientCode', header: 'Code client' },
      { key: 'isActive', header: 'Actif' },
    ],
    rows: rows.map((row) => ({
      email: row.email,
      fullName: row.fullName ?? '',
      clientCode: row.client?.code ?? '',
      isActive: row.isActive ? 'Oui' : 'Non',
    })),
    importRows: canWrite
      ? async (imported) => {
        const clients = await api.getClients();
        return upsertBy(imported, {
          keyOf: (row) => cell(row, 'email'),
          findId: (key) => rows.find((row) => row.email.toLowerCase() === key.toLowerCase())?.id,
          required: (row) => (!cell(row, 'email') || !cell(row, 'nom', 'fullName') ? 'Email et nom requis' : null),
          create: async (row) => {
            const client = clients.find((item) => item.code.toLowerCase() === cell(row, 'code client', 'clientCode').toLowerCase());
            if (!client) throw new Error('Code client introuvable');
            await api.createPortalAccount({
              email: cell(row, 'email'),
              fullName: cell(row, 'nom', 'fullName'),
              password: 'password123',
              clientId: client.id,
            });
          },
          update: (id, row) => api.updatePortalAccount(id, {
            fullName: cell(row, 'nom', 'fullName') || undefined,
            isActive: bool(row, 'actif', 'isActive'),
          }),
        });
      }
      : undefined,
  };
}

export function sheetQuotes(rows: QuoteRequest[]): ExcelSheet {
  return {
    name: 'Devis',
    columns: [
      { key: 'company', header: 'Societe' },
      { key: 'contact', header: 'Contact' },
      { key: 'status', header: 'Statut' },
      { key: 'quotedAmount', header: 'Montant' },
    ],
    rows: rows.map((row) => ({
      company: row.companyName,
      contact: row.contactEmail,
      status: row.status,
      quotedAmount: row.quotedAmount ?? '',
    })),
  };
}

export function sheetSensors(rows: IotSensor[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Capteurs',
    columns: [
      { key: 'code', header: 'Code' },
      { key: 'label', header: 'Libelle' },
      { key: 'kind', header: 'Type' },
      { key: 'metric', header: 'Mesure' },
      { key: 'unit', header: 'Unite' },
      { key: 'status', header: 'Statut' },
    ],
    rows: rows.map((row) => ({
      code: row.code,
      label: row.label,
      kind: row.kind,
      metric: row.metric,
      unit: row.unit,
      status: row.status,
    })),
    importRows: canWrite
      ? (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'code'),
        findId: (key) => rows.find((row) => row.code.toLowerCase() === key.toLowerCase())?.id,
        required: (row) => (!cell(row, 'code') || !cell(row, 'libelle', 'label') ? 'Code et libelle requis' : null),
        create: (row) => api.createSensor({
          code: cell(row, 'code'),
          label: cell(row, 'libelle', 'label'),
          kind: (cell(row, 'type', 'kind') as IotSensor['kind']) || 'QUALITE_LIGNE',
          metric: cell(row, 'mesure', 'metric') || 'valeur',
          unit: cell(row, 'unite', 'unit') || '',
        }),
        update: (id, row) => api.updateSensor(id, {
          label: cell(row, 'libelle', 'label') || undefined,
        }),
      })
      : undefined,
  };
}

export function sheetApiKeys(rows: ApiKeyInfo[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Cles API',
    columns: [
      { key: 'label', header: 'Libelle' },
      { key: 'partner', header: 'Partenaire' },
      { key: 'keyPrefix', header: 'Prefixe' },
      { key: 'scopes', header: 'Perimetres' },
      { key: 'isActive', header: 'Actif' },
    ],
    rows: rows.map((row) => ({
      label: row.label,
      partner: row.partner,
      keyPrefix: row.keyPrefix,
      scopes: row.scopes.join(', '),
      isActive: row.isActive ? 'Oui' : 'Non',
    })),
    importRows: canWrite
      ? async (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'libelle', 'label'),
        findId: () => undefined,
        required: (row) => (!cell(row, 'libelle', 'label') || !cell(row, 'partenaire', 'partner') ? 'Libelle et partenaire requis' : null),
        create: async (row) => {
          await api.createApiKey({
            label: cell(row, 'libelle', 'label'),
            partner: cell(row, 'partenaire', 'partner'),
            scopes: cell(row, 'perimetres', 'scopes').split(',').map((item) => item.trim()).filter(Boolean),
          });
        },
        update: async () => undefined,
      })
      : undefined,
  };
}

export function sheetWebhooks(rows: WebhookSubscription[], canWrite: boolean): ExcelSheet {
  return {
    name: 'Webhooks',
    columns: [
      { key: 'label', header: 'Libelle' },
      { key: 'url', header: 'URL' },
      { key: 'events', header: 'Evenements' },
      { key: 'isActive', header: 'Actif' },
    ],
    rows: rows.map((row) => ({
      label: row.label,
      url: row.url,
      events: row.events.join(', '),
      isActive: row.isActive ? 'Oui' : 'Non',
    })),
    importRows: canWrite
      ? async (imported) => upsertBy(imported, {
        keyOf: (row) => cell(row, 'libelle', 'label'),
        findId: () => undefined,
        required: (row) => (!cell(row, 'libelle', 'label') || !cell(row, 'url') ? 'Libelle et URL requis' : null),
        create: async (row) => {
          await api.createWebhook({
            label: cell(row, 'libelle', 'label'),
            url: cell(row, 'url'),
            events: cell(row, 'evenements', 'events').split(',').map((item) => item.trim()).filter(Boolean),
          });
        },
        update: async () => undefined,
      })
      : undefined,
  };
}

export function exportSheet(name: string, columns: Array<[string, string]>, rows: Array<Record<string, unknown>>): ExcelSheet {
  return {
    name,
    columns: columns.map(([key, header]) => ({ key, header })),
    rows,
  };
}
