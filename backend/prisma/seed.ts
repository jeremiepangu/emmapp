import {
  PrismaClient,
  UserRole,
  ClientSegment,
  ProductFormat,
  StockLocationType,
  OrderStatus,
  TourStatus,
  DeliveryStatus,
  PaymentMethod,
  LoyaltyTier,
  ProductionOrderStatus,
  LotStatus,
  QualityCheckStatus,
  NotificationCategory,
  NotificationType,
  SensorKind,
  SensorStatus,
  QuoteRequestStatus,
  PricingRuleType,
  PackagingKind,
  PackagingPackFormat,
  PackagingMovementType,
  ContractPartyKind,
  BusinessContractKind,
  ContractLifecycle,
  type Order,
  type Delivery,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { buildAgentTemplateSeeds } from '../src/contracts/agent-templates';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@emmapure.cd' },
    update: { firstName: 'Admin', lastName: 'Emmanuel', role: UserRole.ADMIN },
    create: {
      email: 'admin@emmapure.cd',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Emmanuel',
      role: UserRole.ADMIN,
      phone: '+243900000001',
    },
  });

  // Compatibilité comptes EMMAPP
  await prisma.user.upsert({
    where: { email: 'admin@emmapp.cd' },
    update: {},
    create: {
      email: 'admin@emmapp.cd',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Emmanuel',
      role: UserRole.ADMIN,
      phone: '+243900000001',
    },
  });

  const livreur = await prisma.user.upsert({
    where: { email: 'livreur@emmapure.cd' },
    update: { role: UserRole.CHARGE_LIVRAISON },
    create: {
      email: 'livreur@emmapure.cd',
      passwordHash,
      firstName: 'Jean',
      lastName: 'Mukendi',
      role: UserRole.CHARGE_LIVRAISON,
      phone: '+243900000002',
    },
  });

  await prisma.user.upsert({
    where: { email: 'livreur@emmapp.cd' },
    update: {},
    create: {
      email: 'livreur@emmapp.cd',
      passwordHash,
      firstName: 'Jean',
      lastName: 'Mukendi',
      role: UserRole.LIVREUR,
      phone: '+243900000002',
    },
  });

  await prisma.user.upsert({
    where: { email: 'chef.exploit@emmapure.cd' },
    update: {},
    create: {
      email: 'chef.exploit@emmapure.cd',
      passwordHash,
      firstName: 'Paul',
      lastName: 'Kabila',
      role: UserRole.CHEF_EXPLOITATION,
      phone: '+243900000004',
    },
  });

  const qualite = await prisma.user.upsert({
    where: { email: 'qualite@emmapure.cd' },
    update: {},
    create: {
      email: 'qualite@emmapure.cd',
      passwordHash,
      firstName: 'Grace',
      lastName: 'Ilunga',
      role: UserRole.RESP_QUALITE,
      phone: '+243900000005',
    },
  });

  const commercial = await prisma.user.upsert({
    where: { email: 'commercial@emmapure.cd' },
    update: {},
    create: {
      email: 'commercial@emmapure.cd',
      passwordHash,
      firstName: 'Marie',
      lastName: 'Tshilombo',
      role: UserRole.COMMERCIAL,
      phone: '+243900000006',
    },
  });

  const magasinier = await prisma.user.upsert({
    where: { email: 'magasinier@emmapure.cd' },
    update: {},
    create: {
      email: 'magasinier@emmapure.cd',
      passwordHash,
      firstName: 'Patrick',
      lastName: 'Mbuyi',
      role: UserRole.MAGASINIER,
      phone: '+243900000007',
    },
  });

  // Comptes complémentaires : couvrent les profils proposés sur l'écran de connexion.
  const extraAccounts = [
    { email: 'dg@emmapure.cd', firstName: 'Sylvie', lastName: 'Ngoy', role: UserRole.DG, phone: '+243900000008' },
    { email: 'chef.prod@emmapure.cd', firstName: 'Joseph', lastName: 'Kalonji', role: UserRole.CHEF_PRODUCTION, phone: '+243900000009' },
    { email: 'caissier@emmapure.cd', firstName: 'Alice', lastName: 'Mwamba', role: UserRole.CAISSIER, phone: '+243900000010' },
    { email: 'rh@emmapure.cd', firstName: 'Didier', lastName: 'Lukusa', role: UserRole.RH, phone: '+243900000011' },
    { email: 'comptable@emmapure.cd', firstName: 'Nadine', lastName: 'Bofala', role: UserRole.COMPTABLE, phone: '+243900000012' },
    { email: 'superviseur@emmapure.cd', firstName: 'Eric', lastName: 'Mputu', role: UserRole.SUPERVISEUR, phone: '+243900000013' },
    { email: 'it@emmapure.cd', firstName: 'Carine', lastName: 'Kasongo', role: UserRole.IT_GED, phone: '+243900000014' },
    { email: 'analyste@emmapure.cd', firstName: 'Herve', lastName: 'Mbala', role: UserRole.DATA_ANALYST, phone: '+243900000015' },
    { email: 'securite@emmapure.cd', firstName: 'Ines', lastName: 'Nsimba', role: UserRole.RESP_SECURITE, phone: '+243900000016' },
    { email: 'durabilite@emmapure.cd', firstName: 'Olivier', lastName: 'Tumba', role: UserRole.RESP_DURABILITE, phone: '+243900000017' },
  ];

  const byRole: Partial<Record<UserRole, { id: string }>> = {};
  for (const acct of extraAccounts) {
    byRole[acct.role] = await prisma.user.upsert({
      where: { email: acct.email },
      update: { role: acct.role },
      create: { ...acct, passwordHash },
    });
  }
  const chefProduction = byRole[UserRole.CHEF_PRODUCTION]!;
  const caissier = byRole[UserRole.CAISSIER]!;

  void commercial;

  const products = await Promise.all([
    prisma.product.upsert({
      where: { code: 'BIDON-5L' },
      update: {},
      create: {
        code: 'BIDON-5L',
        name: 'EMMA 5L — Eau potable',
        format: ProductFormat.BIDON_5L,
        unitPrice: 2500,
        consigneAmount: 0,
        isReusable: false,
        maxRotations: 3,
        loyaltyPointsPerUnit: 2,
      },
    }),
    prisma.product.upsert({
      where: { code: 'BIDON-10L' },
      update: {},
      create: {
        code: 'BIDON-10L',
        name: 'Bidon 10L PEHD consigné',
        format: ProductFormat.BIDON_10L,
        unitPrice: 4500,
        consigneAmount: 5000,
        isReusable: true,
        maxRotations: 25,
        loyaltyPointsPerUnit: 4,
      },
    }),
    prisma.product.upsert({
      where: { code: 'BIDON-25L' },
      update: {},
      create: {
        code: 'BIDON-25L',
        name: 'Bidon 25L PEHD consigné',
        format: ProductFormat.BIDON_25L,
        unitPrice: 8000,
        consigneAmount: 8000,
        isReusable: true,
        maxRotations: 40,
        loyaltyPointsPerUnit: 8,
      },
    }),
    prisma.product.upsert({
      where: { code: 'BONB-19L' },
      update: {},
      create: {
        code: 'BONB-19L',
        name: 'Bonbonne 19L PC/PET cristal',
        format: ProductFormat.BONBONNE_19L,
        unitPrice: 8000,
        consigneAmount: 15000,
        isReusable: true,
        maxRotations: 50,
        loyaltyPointsPerUnit: 10,
      },
    }),
  ]);

  const existingRules = await prisma.pricingRule.count();
  if (existingRules === 0) {
    await prisma.pricingRule.createMany({
      data: [
        { name: 'Bonus boutique', segment: ClientSegment.BOUTIQUE, minQuantity: 1, stepQuantity: 10, type: PricingRuleType.ARTICLE_OFFERT, value: 1, priority: 0 },
        { name: 'Bonus detaillant', segment: ClientSegment.DETAILLANT, minQuantity: 1, stepQuantity: 10, type: PricingRuleType.ARTICLE_OFFERT, value: 1, priority: 0 },
        { name: 'Bonus supermarche 1-49', segment: ClientSegment.SUPERMARCHE, minQuantity: 1, maxQuantity: 49, stepQuantity: 10, type: PricingRuleType.ARTICLE_OFFERT, value: 1, priority: 0 },
        { name: 'Bonus supermarche volume', segment: ClientSegment.SUPERMARCHE, minQuantity: 50, stepQuantity: 10, type: PricingRuleType.ARTICLE_OFFERT, value: 1, priority: 10 },
        { name: 'Bonus hotel restaurant', segment: ClientSegment.HOTEL_RESTAURANT, minQuantity: 1, stepQuantity: 10, type: PricingRuleType.ARTICLE_OFFERT, value: 1, priority: 0 },
        { name: 'Bonus entreprise', segment: ClientSegment.ENTREPRISE, minQuantity: 1, stepQuantity: 10, type: PricingRuleType.ARTICLE_OFFERT, value: 1, priority: 0 },
      ],
    });
  }

  const vehicle = await prisma.vehicle.upsert({
    where: { plate: 'KIN-1234-AB' },
    update: {},
    create: {
      plate: 'KIN-1234-AB',
      name: 'Camionnette Zone Nord',
      capacity: 200,
      fuelType: 'DIESEL',
      co2FactorKgPerKm: 0.31,
    },
  });

  const locFinis = await prisma.stockLocation.upsert({
    where: { code: 'PF-01' },
    update: {},
    create: {
      code: 'PF-01',
      name: 'Produits finis — Entrepôt principal',
      type: StockLocationType.PRODUITS_FINIS,
    },
  });

  await prisma.stockLocation.upsert({
    where: { code: 'VEH-01' },
    update: {},
    create: {
      code: 'VEH-01',
      name: 'Stock embarqué — KIN-1234-AB',
      type: StockLocationType.VEHICULE,
      vehicleId: vehicle.id,
    },
  });

  for (const product of products) {
    await prisma.stockItem.upsert({
      where: {
        productId_locationId_lotNumber: {
          productId: product.id,
          locationId: locFinis.id,
          lotNumber: 'LOT-DEMO-001',
        },
      },
      update: { quantity: 500 },
      create: {
        productId: product.id,
        locationId: locFinis.id,
        quantity: 500,
        lotNumber: 'LOT-DEMO-001',
      },
    });
  }

  const clients = await Promise.all([
    prisma.client.upsert({
      where: { code: 'CLI-001' },
      update: { segment: ClientSegment.SUPERMARCHE, loyaltyTier: LoyaltyTier.OR, latitude: -4.305, longitude: 15.313, email: 'achat@kinmarche.cd' },
      create: {
        code: 'CLI-001',
        name: 'Supermarché Kin Marché',
        segment: ClientSegment.SUPERMARCHE,
        address: 'Av. Lumumba, Gombe',
        city: 'Kinshasa',
        zone: 'Gombe',
        latitude: -4.305,
        longitude: 15.313,
        phone: '+243810000001',
        email: 'achat@kinmarche.cd',
        creditLimit: 500000,
        consigneLimit: 100,
        loyaltyPoints: 320,
        loyaltyTier: LoyaltyTier.OR,
      },
    }),
    prisma.client.upsert({
      where: { code: 'CLI-002' },
      update: { segment: ClientSegment.BOUTIQUE, latitude: -4.383, longitude: 15.391, email: 'client@boutique-kintambo.cd' },
      create: {
        code: 'CLI-002',
        name: 'Boutique Maman Nana',
        segment: ClientSegment.BOUTIQUE,
        address: 'Quartier Masina',
        city: 'Kinshasa',
        zone: 'Masina',
        latitude: -4.383,
        longitude: 15.391,
        phone: '+243810000002',
        email: 'client@boutique-kintambo.cd',
        creditLimit: 100000,
        consigneLimit: 50,
        loyaltyPoints: 85,
        loyaltyTier: LoyaltyTier.BRONZE,
      },
    }),
    prisma.client.upsert({
      where: { code: 'CLI-003' },
      update: { segment: ClientSegment.HOTEL_RESTAURANT, latitude: -4.343, longitude: 15.266, email: 'fnd@rawtech.cd' },
      create: {
        code: 'CLI-003',
        name: 'Hôtel RawTech & Restaurant',
        segment: ClientSegment.HOTEL_RESTAURANT,
        address: 'Bandalungwa',
        city: 'Kinshasa',
        zone: 'Bandalungwa',
        latitude: -4.343,
        longitude: 15.266,
        phone: '+243810000003',
        email: 'fnd@rawtech.cd',
        creditLimit: 1000000,
        consigneLimit: 30,
        loyaltyPoints: 150,
        loyaltyTier: LoyaltyTier.ARGENT,
      },
    }),
    prisma.client.upsert({
      where: { code: 'CLI-POS' },
      update: { name: 'Comptoir / passage', segment: ClientSegment.PARTICULIER, zone: 'Comptoir' },
      create: {
        code: 'CLI-POS',
        name: 'Comptoir / passage',
        segment: ClientSegment.PARTICULIER,
        city: 'Kinshasa',
        zone: 'Comptoir',
        consigneLimit: 0,
      },
    }),
  ]);

  // Minuit UTC : les colonnes de type date sont stockées en UTC, un minuit local
  // décalerait les vacations et tournées d'un jour pour les fuseaux positifs.
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const tour = await prisma.tour.upsert({
    where: { tourNumber: 'TR-DEMO-001' },
    // La tournée de démonstration est toujours replacée sur la journée courante.
    update: { date: today },
    create: {
      tourNumber: 'TR-DEMO-001',
      zone: 'Kinshasa Nord',
      date: today,
      driverId: livreur.id,
      vehicleId: vehicle.id,
      status: TourStatus.PLANIFIEE,
    },
  });

  const demoOrders: Order[] = [];
  for (const client of clients.slice(0, 2)) {
    demoOrders.push(await prisma.order.upsert({
      where: { orderNumber: `CMD-DEMO-${client.code}` },
      update: {},
      create: {
        orderNumber: `CMD-DEMO-${client.code}`,
        clientId: client.id,
        tourId: tour.id,
        status: OrderStatus.VALIDEE,
        totalAmount: 50000,
        lines: {
          create: [
            {
              productId: products[2].id,
              quantity: 10,
              unitPrice: products[2].unitPrice,
            },
            {
              productId: products[3].id,
              quantity: 5,
              unitPrice: products[3].unitPrice,
            },
          ],
        },
      },
    }));
  }

  for (let week = 1; week <= 8; week += 1) {
    const when = new Date(Date.now() - week * 7 * 24 * 3600_000);
    for (let c = 0; c < clients.length; c += 1) {
      const orderNumber = `CMD-HIST-W${week}-${clients[c].code}`;
      const qty = 8 + ((week + c) % 5);
      await prisma.order.upsert({
        where: { orderNumber },
        update: {},
        create: {
          orderNumber,
          clientId: clients[c].id,
          status: OrderStatus.LIVREE,
          totalAmount: qty * Number(products[0].unitPrice),
          createdAt: when,
          lines: {
            create: [{ productId: products[0].id, quantity: qty, unitPrice: products[0].unitPrice }],
          },
        },
      });
    }
  }

  const po = await prisma.productionOrder.upsert({
    where: { lotNumber: 'LOT-20260814-L1-BONBONNE_19L-001' },
    update: {},
    create: {
      orderNumber: 'OF-20260814-0001',
      lotNumber: 'LOT-20260814-L1-BONBONNE_19L-001',
      productFormat: ProductFormat.BONBONNE_19L,
      lineCode: 'L1',
      plannedQty: 500,
      producedQty: 480,
      status: ProductionOrderStatus.EN_COURS,
      lotStatus: LotStatus.QUARANTAINE,
    },
  });

  await prisma.qualityCheck.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      productionOrderId: po.id,
      lotNumber: po.lotNumber,
      ph: 7.2,
      chlorineFree: 0.3,
      tds: 45,
      turbidity: 0.5,
      microbiologyOk: true,
      status: QualityCheckStatus.EN_ATTENTE,
    },
  });

  // ── Livraisons : une complète, une partielle avec refus et reprise d'emballages ──
  const deliverySpecs = [
    {
      number: 'LIV-DEMO-001',
      order: demoOrders[0],
      status: DeliveryStatus.LIVREE,
      latitude: -4.3217,
      longitude: 15.3125,
      notes: undefined as string | undefined,
      lines: [
        { productId: products[2].id, qtyDelivered: 10, qtyReturned: 8, qtyRefused: 0, unitPrice: products[2].unitPrice },
        { productId: products[3].id, qtyDelivered: 5, qtyReturned: 5, qtyRefused: 0, unitPrice: products[3].unitPrice },
      ],
    },
    {
      number: 'LIV-DEMO-002',
      order: demoOrders[1],
      status: DeliveryStatus.PARTIELLE,
      latitude: -4.3901,
      longitude: 15.4102,
      notes: 'Client absent pour une partie de la commande',
      lines: [
        { productId: products[2].id, qtyDelivered: 6, qtyReturned: 4, qtyRefused: 4, unitPrice: products[2].unitPrice },
        { productId: products[3].id, qtyDelivered: 5, qtyReturned: 3, qtyRefused: 0, unitPrice: products[3].unitPrice },
      ],
    },
  ];

  const deliveries: Delivery[] = [];
  for (const spec of deliverySpecs) {
    const existing = await prisma.delivery.findUnique({ where: { deliveryNumber: spec.number } });
    deliveries.push(
      existing ??
        (await prisma.delivery.create({
          data: {
            deliveryNumber: spec.number,
            orderId: spec.order.id,
            clientId: spec.order.clientId,
            tourId: tour.id,
            driverId: livreur.id,
            status: spec.status,
            deliveredAt: new Date(),
            latitude: spec.latitude,
            longitude: spec.longitude,
            notes: spec.notes,
            lines: { create: spec.lines },
          },
        })),
    );
  }

  // Le solde de consignes est dérivé des mouvements, jamais saisi directement.
  for (const [index, spec] of deliverySpecs.entries()) {
    const delivery = deliveries[index];
    await prisma.consigneMovement.deleteMany({ where: { deliveryId: delivery.id } });
    let balance = 0;
    for (const line of spec.lines) {
      const product = products.find((p) => p.id === line.productId);
      if (!product?.isReusable) continue;
      balance += line.qtyDelivered - line.qtyReturned;
      await prisma.consigneMovement.create({
        data: {
          clientId: delivery.clientId,
          deliveryId: delivery.id,
          productFormat: product.format,
          qtyOut: line.qtyDelivered,
          qtyIn: line.qtyReturned,
          balanceAfter: balance,
        },
      });
    }
    await prisma.client.update({
      where: { id: delivery.clientId },
      data: { consigneBalance: balance },
    });
  }

  // ── Encaissements couvrant les moyens de paiement, dont la monnaie électronique ──
  const paymentSpecs = [
    { number: 'PAY-DEMO-001', client: 0, delivery: 0, amount: 50000, method: PaymentMethod.ESPECES, reference: 'CAISSE-0001' },
    { number: 'PAY-DEMO-002', client: 2, delivery: null, amount: 300000, method: PaymentMethod.MPESA, reference: 'MP-88213004' },
    { number: 'PAY-DEMO-003', client: 0, delivery: null, amount: 120000, method: PaymentMethod.ORANGE_MONEY, reference: 'OM-55120987' },
    { number: 'PAY-DEMO-004', client: 1, delivery: 1, amount: 75000, method: PaymentMethod.AIRTEL_MONEY, reference: 'AM-41007733' },
    { number: 'PAY-DEMO-005', client: 2, delivery: null, amount: 450000, method: PaymentMethod.CHEQUE, reference: 'CHQ-000145' },
  ];

  for (const spec of paymentSpecs) {
    await prisma.payment.upsert({
      where: { paymentNumber: spec.number },
      update: {},
      create: {
        paymentNumber: spec.number,
        clientId: clients[spec.client].id,
        deliveryId: spec.delivery === null ? undefined : deliveries[spec.delivery].id,
        amount: spec.amount,
        method: spec.method,
        reference: spec.reference,
        collectedBy: caissier.id,
      },
    });
  }

  // Rejouable : les vacations de démonstration sont remplacées à chaque exécution.
  const shiftMarker = 'Vacation de démonstration';
  await prisma.shiftAssignment.deleteMany({ where: { notes: shiftMarker } });
  await prisma.shiftAssignment.createMany({
    data: [
      { userId: magasinier.id, date: today, startTime: '06:00', endTime: '12:00', postLabel: 'Chargement / bordereaux', notes: shiftMarker },
      { userId: chefProduction.id, date: today, startTime: '06:00', endTime: '14:00', postLabel: 'Supervision ligne L1', notes: shiftMarker },
      { userId: livreur.id, date: today, startTime: '07:00', endTime: '13:00', postLabel: 'Livraison zone Gombe', notes: shiftMarker },
      { userId: qualite.id, date: today, startTime: '08:00', endTime: '16:00', postLabel: 'Contrôles libératoires', notes: shiftMarker },
      { userId: caissier.id, date: today, startTime: '08:00', endTime: '17:00', postLabel: 'Caisse encaissements', notes: shiftMarker },
      { userId: livreur.id, date: today, startTime: '14:00', endTime: '17:00', postLabel: 'Agent chargeur', notes: shiftMarker },
    ],
  });

  await prisma.packagingUnit.createMany({
    data: [
      { barcode: 'BB19-00001', productFormat: ProductFormat.BONBONNE_19L, rotationCount: 12, maxRotations: 50 },
      { barcode: 'BD10-00042', productFormat: ProductFormat.BIDON_10L, rotationCount: 22, maxRotations: 25 },
      { barcode: 'BD25-00008', productFormat: ProductFormat.BIDON_25L, rotationCount: 38, maxRotations: 40, status: 'ALERTE' },
    ],
    skipDuplicates: true,
  });

  const packFormats: Array<{ format: PackagingPackFormat; label: string; slug: string }> = [
    { format: PackagingPackFormat.BIDON_5L, label: 'Bidon 5 L', slug: '5L' },
    { format: PackagingPackFormat.BIDON_10L, label: 'Bidon 10 L', slug: '10L' },
    { format: PackagingPackFormat.BIDON_25L, label: 'Bidon 25 L', slug: '25L' },
    { format: PackagingPackFormat.BONBONNE_5G, label: 'Bonbonne 5 gallons', slug: '5G' },
  ];
  const packKinds: Array<{ kind: PackagingKind; prefix: string; noun: string; minStock: number; qty: Record<string, number> }> = [
    { kind: PackagingKind.EMBALLAGE, prefix: 'EMB', noun: 'Emballage vide', minStock: 40, qty: { '5L': 200, '10L': 150, '25L': 80, '5G': 120 } },
    { kind: PackagingKind.ETIQUETTE, prefix: 'ETQ', noun: 'Étiquette', minStock: 80, qty: { '5L': 500, '10L': 400, '25L': 250, '5G': 300 } },
    { kind: PackagingKind.BOUCHON, prefix: 'BOU', noun: 'Bouchon', minStock: 80, qty: { '5L': 400, '10L': 350, '25L': 200, '5G': 280 } },
  ];

  await prisma.packagingMovement.deleteMany({ where: { reference: { startsWith: 'SEED-EMB' } } });

  for (const kind of packKinds) {
    for (const format of packFormats) {
      const code = `${kind.prefix}-${format.slug}`;
      const sku = await prisma.packagingSku.upsert({
        where: { code },
        update: { name: `${kind.noun} ${format.label}`, kind: kind.kind, format: format.format, minStock: kind.minStock, isActive: true },
        create: {
          code,
          name: `${kind.noun} ${format.label}`,
          kind: kind.kind,
          format: format.format,
          minStock: kind.minStock,
        },
      });
      const bought = kind.qty[format.slug];
      const used = kind.kind === PackagingKind.EMBALLAGE && format.slug === '5L' ? 20 : 0;
      const scrapped = kind.kind === PackagingKind.BOUCHON && format.slug === '10L' ? 10 : 0;
      await prisma.packagingStock.upsert({
        where: { skuId: sku.id },
        update: { quantity: bought - used - scrapped },
        create: { skuId: sku.id, quantity: bought - used - scrapped },
      });
      await prisma.packagingMovement.create({
        data: {
          skuId: sku.id,
          type: PackagingMovementType.ACHAT,
          quantity: bought,
          supplier: 'Plastiques Kinshasa SARL',
          reference: 'SEED-EMB-ACHAT',
          notes: 'Réception initiale magasin emballages',
          createdById: magasinier.id,
        },
      });
      if (used) {
        await prisma.packagingMovement.create({
          data: {
            skuId: sku.id,
            type: PackagingMovementType.UTILISATION,
            quantity: used,
            reference: 'SEED-EMB-UTIL',
            notes: 'Consommation ligne L1 — remplissage',
            createdById: chefProduction.id,
          },
        });
      }
      if (scrapped) {
        await prisma.packagingMovement.create({
          data: {
            skuId: sku.id,
            type: PackagingMovementType.DECLASSEMENT,
            quantity: scrapped,
            reference: 'SEED-EMB-DECL',
            notes: 'Lot fêlé — rebut',
            createdById: magasinier.id,
          },
        });
      }
    }
  }

  await prisma.fountainAsset.createMany({
    data: [
      { serialNumber: 'FNT-2024-001', clientId: clients[2].id, model: 'Fontaine FR-200', contractType: 'LOCATION', fillLevelPct: 42 },
    ],
    skipDuplicates: true,
  });

  const fountain = await prisma.fountainAsset.findUnique({ where: { serialNumber: 'FNT-2024-001' } });

  const sensorPh = await prisma.iotSensor.upsert({
    where: { code: 'L1-PH' },
    update: { status: SensorStatus.ACTIF, lastSeenAt: new Date() },
    create: {
      code: 'L1-PH',
      label: 'pH ligne L1',
      kind: SensorKind.QUALITE_LIGNE,
      metric: 'ph',
      unit: '',
      minValue: 6.5,
      maxValue: 8.5,
      machineCode: 'FILTRE-L1',
      lineCode: 'L1',
      lastSeenAt: new Date(),
    },
  });
  await prisma.iotSensor.upsert({
    where: { code: 'L1-CL' },
    update: { lastSeenAt: new Date() },
    create: {
      code: 'L1-CL',
      label: 'Chlore résiduel L1',
      kind: SensorKind.QUALITE_LIGNE,
      metric: 'chlore',
      unit: 'mg/L',
      minValue: 0.2,
      maxValue: 0.6,
      machineCode: 'FILTRE-L1',
      lineCode: 'L1',
      lastSeenAt: new Date(),
    },
  });
  await prisma.iotSensor.upsert({
    where: { code: 'VH-GPS-LAT' },
    update: { lastSeenAt: new Date() },
    create: {
      code: 'VH-GPS-LAT',
      label: 'Latitude camionnette',
      kind: SensorKind.VEHICULE,
      metric: 'position_lat',
      unit: '°',
      vehicleId: vehicle.id,
      lastSeenAt: new Date(),
    },
  });
  await prisma.iotSensor.upsert({
    where: { code: 'VH-GPS-LNG' },
    update: { lastSeenAt: new Date() },
    create: {
      code: 'VH-GPS-LNG',
      label: 'Longitude camionnette',
      kind: SensorKind.VEHICULE,
      metric: 'position_lng',
      unit: '°',
      vehicleId: vehicle.id,
      lastSeenAt: new Date(),
    },
  });
  await prisma.iotSensor.upsert({
    where: { code: 'VH-VIT' },
    update: { lastSeenAt: new Date() },
    create: {
      code: 'VH-VIT',
      label: 'Vitesse camionnette',
      kind: SensorKind.VEHICULE,
      metric: 'vitesse',
      unit: 'km/h',
      vehicleId: vehicle.id,
      lastSeenAt: new Date(),
    },
  });
  await prisma.iotSensor.upsert({
    where: { code: 'VH-CARB' },
    update: { lastSeenAt: new Date() },
    create: {
      code: 'VH-CARB',
      label: 'Carburant camionnette',
      kind: SensorKind.VEHICULE,
      metric: 'carburant',
      unit: '%',
      minValue: 10,
      maxValue: 100,
      vehicleId: vehicle.id,
      lastSeenAt: new Date(),
    },
  });
  if (fountain) {
    await prisma.iotSensor.upsert({
      where: { code: 'FNT-NIV-001' },
      update: { lastSeenAt: new Date(), fountainId: fountain.id },
      create: {
        code: 'FNT-NIV-001',
        label: 'Niveau fontaine RawTech',
        kind: SensorKind.FONTAINE,
        metric: 'niveau',
        unit: '%',
        minValue: 15,
        maxValue: 100,
        fountainId: fountain.id,
        lastSeenAt: new Date(),
      },
    });
  }

  await prisma.sensorReading.deleteMany({ where: { sensor: { code: { in: ['L1-PH', 'L1-CL', 'VH-GPS-LAT', 'VH-GPS-LNG', 'VH-VIT', 'VH-CARB', 'FNT-NIV-001'] } } } });
  await prisma.sensorReading.createMany({
    data: [
      { sensorId: sensorPh.id, value: 7.2, outOfRange: false },
      { sensorId: sensorPh.id, value: 7.1, outOfRange: false },
    ],
  });

  await prisma.portalAccount.upsert({
    where: { email: 'client@boutique-kintambo.cd' },
    update: { isActive: true, fullName: 'Nana Masina' },
    create: {
      email: 'client@boutique-kintambo.cd',
      passwordHash,
      clientId: clients[1].id,
      fullName: 'Nana Masina',
    },
  });

  await prisma.quoteRequest.upsert({
    where: { reference: 'DEV-2026-00001' },
    update: { status: QuoteRequestStatus.NOUVELLE },
    create: {
      reference: 'DEV-2026-00001',
      clientId: clients[0].id,
      companyName: 'Grossiste Gombe Distribution',
      contactEmail: 'achat@kinmarche.cd',
      contactPhone: '+243810000001',
      segment: ClientSegment.SUPERMARCHE,
      zone: 'Gombe',
      lines: [{ productId: products[0].id, productName: products[0].name, quantity: 200 }],
      message: 'Commande récurrente hebdomadaire 5L.',
    },
  });

  await prisma.webhookSubscription.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: { isActive: true },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      label: 'Passrelle mobile money (démo)',
      url: 'https://hooks.emmapure.cd/events',
      events: ['paiement.enregistre', 'commande.creee'],
      secret: 'demo-webhook-secret',
    },
  });

  const allUsers = await prisma.user.findMany({ where: { isActive: true } });

  const salaryByRole: Record<string, number> = {
    ADMIN: 2500000, DG: 4500000, CHEF_PRODUCTION: 1800000, CHEF_EXPLOITATION: 1800000,
    CHARGE_EXPLOITATION: 900000, RESP_QUALITE: 1400000, MAGASINIER: 750000, AGENT_CHARGEUR: 450000,
    LIVREUR: 550000, CHARGE_LIVRAISON: 650000, COMMERCIAL: 1200000, DELEGUE_COMMERCIAL: 800000,
    CAISSIER: 700000, COMPTABLE: 1300000, RH: 1200000, SUPERVISEUR: 1100000, IT_GED: 1400000,
    DATA_ANALYST: 1500000, RESP_SECURITE: 1400000, RESP_DURABILITE: 1300000,
  };
  const deptByRole: Record<string, string> = {
    ADMIN: 'Direction', DG: 'Direction', CHEF_PRODUCTION: 'Production', CHEF_EXPLOITATION: 'Exploitation',
    CHARGE_EXPLOITATION: 'Exploitation', RESP_QUALITE: 'Qualité', MAGASINIER: 'Exploitation',
    AGENT_CHARGEUR: 'Exploitation', LIVREUR: 'Exploitation', CHARGE_LIVRAISON: 'Exploitation',
    COMMERCIAL: 'Commercial', DELEGUE_COMMERCIAL: 'Commercial', CAISSIER: 'Finance', COMPTABLE: 'Finance',
    RH: 'RH', SUPERVISEUR: 'Direction', IT_GED: 'IT', DATA_ANALYST: 'Direction', RESP_SECURITE: 'IT',
    RESP_DURABILITE: 'Production',
  };
  const functionByRole: Record<string, string> = {
    ADMIN: 'Direction', DG: 'Direction', CHEF_PRODUCTION: 'Chef production', CHEF_EXPLOITATION: 'Chef exploitation',
    CHARGE_EXPLOITATION: 'Chargé exploitation', RESP_QUALITE: 'Qualité', MAGASINIER: 'Magasinier',
    AGENT_CHARGEUR: 'Agent chargeur', LIVREUR: 'Livreur', CHARGE_LIVRAISON: 'Chargé livraison',
    COMMERCIAL: 'Commercial', DELEGUE_COMMERCIAL: 'Délégué commercial', CAISSIER: 'Caissier', COMPTABLE: 'Comptable',
    RH: 'RH', SUPERVISEUR: 'Superviseur', IT_GED: 'IT / GED', DATA_ANALYST: 'Analyste de données',
    RESP_SECURITE: 'Sécurité', RESP_DURABILITE: 'Durabilité',
  };
  const functionSeeds = [
    { name: 'Direction', department: 'Direction', activities: ['Pilotage', 'Arbitrage', 'Revue des rapports'] },
    { name: 'Chef production', department: 'Production', activities: ['Planification de production', 'Suivi des OF', 'Encadrement ligne'] },
    { name: 'Opérateur production', department: 'Production', activities: ['Conduite de ligne', 'Contrôle qualité en ligne', 'Lavage des bidons'] },
    { name: 'Chef exploitation', department: 'Exploitation', activities: ['Planification des tournées', 'Suivi parc', 'Coordination livraisons'] },
    { name: 'Chargé exploitation', department: 'Exploitation', activities: ['Préparation tournée', 'Suivi véhicules', 'Pointage livraisons'] },
    { name: 'Qualité', department: 'Qualité', activities: ['Prélèvements', 'Analyses laboratoire', 'Libération de lots'] },
    { name: 'Magasinier', department: 'Exploitation', activities: ['Réception stock', 'Inventaire', 'Chargement véhicule'] },
    { name: 'Agent chargeur', department: 'Exploitation', activities: ['Chargement palettes', 'Contrôle colis', 'Arrimage'] },
    { name: 'Livreur', department: 'Exploitation', activities: ['Préparation de tournée', 'Livraison client', 'Encaissement terrain', 'Retour des consignes'] },
    { name: 'Chargé livraison', department: 'Exploitation', activities: ['Affectation livreurs', 'Suivi POD', 'Relance clients'] },
    { name: 'Commercial', department: 'Commercial', activities: ['Prospection', 'Prise de commande', 'Suivi client'] },
    { name: 'Délégué commercial', department: 'Commercial', activities: ['Visite point de vente', 'Recueil commandes', 'Animation réseau'] },
    { name: 'Caissier', department: 'Finance', activities: ['Encaissement caisse', 'Clôture de journée', 'Remise en banque'] },
    { name: 'Comptable', department: 'Finance', activities: ['Saisie des écritures', 'Rapprochements bancaires', 'Classement des pièces comptables', 'Production des états financiers'] },
    { name: 'RH', department: 'RH', activities: ['Gestion dossiers', 'Suivi congés', 'Paie collaborateurs'] },
    { name: 'Superviseur', department: 'Direction', activities: ['Contrôle terrain', 'Rapport d’anomalie', 'Brief équipes'] },
    { name: 'IT / GED', department: 'IT', activities: ['Support applicatif', 'Sauvegarde GED', 'Suivi incidents'] },
    { name: 'Analyste de données', department: 'Direction', activities: ['Extraction KPI', 'Modèles prédictifs', 'Tableaux de bord'] },
    { name: 'Sécurité', department: 'IT', activities: ['Rondes site', 'Contrôle d’accès', 'Incidents sécurité'] },
    { name: 'Durabilité', department: 'Production', activities: ['Suivi consommations', 'Indicateurs ESG', 'Rapport environnemental'] },
  ];
  const functionsByName = new Map<string, string>();
  for (const fn of functionSeeds) {
    const created = await prisma.jobFunction.upsert({
      where: { name: fn.name },
      update: { department: fn.department },
      create: { name: fn.name, department: fn.department },
    });
    functionsByName.set(fn.name, created.id);
    for (const act of fn.activities) {
      const exists = await prisma.jobFunctionActivity.findFirst({ where: { functionId: created.id, name: act } });
      if (!exists) {
        await prisma.jobFunctionActivity.create({ data: { functionId: created.id, name: act } });
      }
    }
  }

  let empIndex = 0;
  for (const user of allUsers) {
    empIndex += 1;
    const matricule = `EMP-${String(empIndex).padStart(4, '0')}`;
    const functionId = functionsByName.get(functionByRole[user.role] ?? '');
    await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      update: {
        baseSalary: salaryByRole[user.role] ?? 500000,
        department: deptByRole[user.role] ?? 'Exploitation',
        jobFunctionId: functionId,
      },
      create: {
        userId: user.id,
        matricule,
        jobTitle: user.role.replace(/_/g, ' '),
        department: deptByRole[user.role] ?? 'Exploitation',
        hireDate: new Date('2024-01-08'),
        baseSalary: salaryByRole[user.role] ?? 500000,
        cnssNumber: `CNSS-${String(10000 + empIndex)}`,
        jobFunctionId: functionId,
      },
    });
  }
  const rhUser = allUsers.find((u) => u.role === UserRole.RH);
  if (rhUser) {
    const existingLeave = await prisma.leaveRequest.findFirst({ where: { userId: rhUser.id, reason: 'Seed congé annuel' } });
    if (!existingLeave) {
      await prisma.leaveRequest.create({
        data: {
          userId: rhUser.id,
          type: 'CONGE_PAYE',
          startDate: new Date('2026-08-20'),
          endDate: new Date('2026-08-25'),
          days: 6,
          reason: 'Seed congé annuel',
          status: 'SOUMISE',
        },
      });
    }
  }

  const courses = [
    { title: 'Hygiène et HACCP', kind: 'INTERNE' as const, location: 'Usine Bandalungwa' },
    { title: 'Conduite défensive', kind: 'EXTERNE' as const, provider: 'Auto-école Kinshasa' },
  ];
  for (const c of courses) {
    const exists = await prisma.trainingCourse.findFirst({ where: { title: c.title } });
    if (!exists) await prisma.trainingCourse.create({ data: c });
  }
  const payrollNow = new Date();
  await prisma.payrollPeriod.upsert({
    where: { year_month: { year: payrollNow.getFullYear(), month: payrollNow.getMonth() + 1 } },
    update: {},
    create: { year: payrollNow.getFullYear(), month: payrollNow.getMonth() + 1, expectedDays: 26, notes: 'Période initiale' },
  });

  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { code: 'FRN-001' },
      update: { name: 'Plastiques Kinshasa SARL', category: 'Emballages', isActive: true },
      create: {
        code: 'FRN-001',
        name: 'Plastiques Kinshasa SARL',
        category: 'Emballages',
        contactName: 'Jean Mbala',
        phone: '+243810100001',
        email: 'ventes@plastiques-kin.cd',
        address: 'Zone industrielle, Limete',
        rccm: 'CD/KNG/RCCM/22-B-01001',
      },
    }),
    prisma.supplier.upsert({
      where: { code: 'FRN-002' },
      update: { name: 'Etiquettes Congo', category: 'Consommables', isActive: true },
      create: {
        code: 'FRN-002',
        name: 'Etiquettes Congo',
        category: 'Consommables',
        contactName: 'Amina Diallo',
        phone: '+243810100002',
        email: 'commande@etiquettes-congo.cd',
        address: 'Ngaliema',
      },
    }),
    prisma.supplier.upsert({
      where: { code: 'FRN-003' },
      update: { name: 'Chimie Kinoise', category: 'Traitement eau', isActive: true },
      create: {
        code: 'FRN-003',
        name: 'Chimie Kinoise',
        category: 'Traitement eau',
        contactName: 'Paul Kalala',
        phone: '+243810100003',
        email: 'labo@chimie-kinoise.cd',
        address: 'Lemba',
      },
    }),
  ]);

  const templateSeeds = buildAgentTemplateSeeds();
  for (const tpl of templateSeeds) {
    await prisma.contractTemplate.upsert({
      where: { code: tpl.code },
      update: { name: tpl.name, body: tpl.body, clauses: tpl.clauses, footer: tpl.footer, title: tpl.title, partyKind: tpl.partyKind, kind: tpl.kind, isActive: true },
      create: tpl,
    });
  }

  const agentForContract = allUsers.find((u) => u.role === UserRole.LIVREUR) ?? livreur;
  const agentProfile = await prisma.employeeProfile.findUnique({ where: { userId: agentForContract.id } });
  const adminUser = allUsers.find((u) => u.role === UserRole.ADMIN);

  if (agentProfile) {
    await prisma.contract.upsert({
      where: { reference: 'CTR-2026-0001' },
      update: { status: ContractLifecycle.ACTIF, employeeId: agentProfile.id },
      create: {
        reference: 'CTR-2026-0001',
        partyKind: ContractPartyKind.AGENT,
        title: 'Contrat de travail livreur',
        kind: BusinessContractKind.CDI,
        status: ContractLifecycle.ACTIF,
        startDate: new Date('2024-01-08'),
        amount: 550000,
        currency: 'CDF',
        paymentTerms: 'Mensuel',
        employeeId: agentProfile.id,
        validatedById: adminUser?.id,
        validatedAt: new Date('2024-01-08'),
        signedByCompany: 'EMMANUEL SERVICES SARLU',
        signedByParty: `${agentForContract.firstName} ${agentForContract.lastName}`.trim(),
        clauses: 'Contrat a duree indeterminee. Preavis 30 jours. Affiliation CNSS.',
      },
    });
  }

  await prisma.contract.upsert({
    where: { reference: 'CTR-2026-0002' },
    update: { supplierId: suppliers[0].id, status: ContractLifecycle.ACTIF },
    create: {
      reference: 'CTR-2026-0002',
      partyKind: ContractPartyKind.SUPPLIER,
      title: 'Fourniture bidons et bouchons',
      kind: BusinessContractKind.CADRE,
      status: ContractLifecycle.ACTIF,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      amount: 18000000,
      currency: 'CDF',
      paymentTerms: '30 jours',
      billingCycle: 'Mensuel',
      autoRenew: true,
      noticeDays: 45,
      supplierId: suppliers[0].id,
      territory: 'Kinshasa',
      validatedById: adminUser?.id,
      validatedAt: new Date('2026-01-01'),
      signedByCompany: 'EMMANUEL SERVICES SARLU',
      signedByParty: 'Plastiques Kinshasa SARL',
      clauses: 'Prix fermes 12 mois. Livraison usine Bandalungwa. Penalite 2% par semaine de retard.',
    },
  });

  await prisma.contract.upsert({
    where: { reference: 'CTR-2026-0003' },
    update: { clientId: clients[0].id, status: ContractLifecycle.ACTIF },
    create: {
      reference: 'CTR-2026-0003',
      partyKind: ContractPartyKind.KEY_CLIENT,
      title: 'Contrat cadre distribution Kin Marche',
      kind: BusinessContractKind.DISTRIBUTION,
      status: ContractLifecycle.ACTIF,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2027-01-31'),
      amount: 96000000,
      currency: 'CDF',
      paymentTerms: '15 jours',
      billingCycle: 'Hebdomadaire',
      volumeCommitment: '200 bidons 5L / semaine',
      exclusivity: false,
      territory: 'Gombe',
      clientId: clients[0].id,
      validatedById: adminUser?.id,
      validatedAt: new Date('2026-02-01'),
      signedByCompany: 'EMMANUEL SERVICES SARLU',
      signedByParty: 'Supermarche Kin Marche',
      clauses: 'Livraison 3 fois par semaine. Consignes selon bareme en vigueur. Bonus volume catalogue.',
    },
  });
  const notifTemplates: Array<{
    roles: UserRole[];
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
  }> = [
    { roles: [UserRole.ADMIN, UserRole.DG], title: 'Supervision système', message: 'Tous les services EMMANUEL SERVICES SARLU sont opérationnels.', type: NotificationType.SUCCESS, category: NotificationCategory.SYSTEME },
    { roles: [UserRole.CHEF_PRODUCTION, UserRole.ADMIN], title: 'OF en cours', message: 'Lot EMMA 5L — ligne L1 en production.', type: NotificationType.INFO, category: NotificationCategory.PRODUCTION },
    { roles: [UserRole.RESP_QUALITE, UserRole.ADMIN], title: 'Contrôle qualité en attente', message: 'Validation HACCP requise pour le lot du jour.', type: NotificationType.WARNING, category: NotificationCategory.QUALITE },
    { roles: [UserRole.CHEF_EXPLOITATION, UserRole.MAGASINIER], title: 'Tournée planifiée', message: 'Tournée Bandalungwa — chargement à prévoir.', type: NotificationType.INFO, category: NotificationCategory.TOURNEE },
    { roles: [UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON], title: 'Livraison assignée', message: '3 commandes sur votre tournée du jour.', type: NotificationType.INFO, category: NotificationCategory.LIVRAISON },
    { roles: [UserRole.COMMERCIAL, UserRole.DELEGUE_COMMERCIAL], title: 'Commande validée', message: 'Supermarché Kin Marché — commande prête.', type: NotificationType.SUCCESS, category: NotificationCategory.COMMANDE },
    { roles: [UserRole.CAISSIER, UserRole.COMPTABLE], title: 'Encaissement', message: 'Paiements mobile money à rapprocher.', type: NotificationType.INFO, category: NotificationCategory.PAIEMENT },
    { roles: [UserRole.MAGASINIER], title: 'Stock bas', message: 'EMMA 5L — seuil minimum atteint.', type: NotificationType.ALERT, category: NotificationCategory.STOCK },
    { roles: [UserRole.RH, UserRole.COMPTABLE], title: 'Paie du mois', message: 'La periode de paie est prete a etre calculee.', type: NotificationType.INFO, category: NotificationCategory.RH },
    { roles: [UserRole.IT_GED, UserRole.SUPERVISEUR], title: 'Supervision', message: '1 sync mobile en attente.', type: NotificationType.WARNING, category: NotificationCategory.SUPERVISION },
    { roles: [UserRole.DATA_ANALYST, UserRole.ADMIN, UserRole.DG], title: 'Prévision de demande', message: 'Les prévisions à 7 jours sont prêtes à être actualisées.', type: NotificationType.INFO, category: NotificationCategory.IA },
    { roles: [UserRole.RESP_QUALITE, UserRole.CHEF_PRODUCTION, UserRole.IT_GED], title: 'Capteur hors plage', message: 'Le pH de la ligne L1 a été hors plage récemment.', type: NotificationType.ALERT, category: NotificationCategory.IOT },
    { roles: [UserRole.RESP_DURABILITE, UserRole.DG], title: 'Rapport ESG', message: 'Les indicateurs de durabilité du mois sont disponibles.', type: NotificationType.INFO, category: NotificationCategory.ESG },
    { roles: [UserRole.RESP_SECURITE, UserRole.IT_GED, UserRole.ADMIN], title: 'Couverture MFA', message: 'Activez le second facteur sur les comptes sensibles.', type: NotificationType.WARNING, category: NotificationCategory.SECURITE },
    { roles: [UserRole.COMMERCIAL, UserRole.ADMIN], title: 'Commande portail', message: 'Une commande self-service peut arriver via le portail client.', type: NotificationType.INFO, category: NotificationCategory.PORTAIL },
  ];

  // Rejouable : sans cela, chaque exécution du seed empilerait un nouveau jeu d'alertes.
  await prisma.notification.deleteMany({
    where: { title: { in: notifTemplates.map((tpl) => tpl.title) } },
  });

  for (const user of allUsers) {
    for (const tpl of notifTemplates) {
      if (tpl.roles.includes(user.role)) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: tpl.title,
            message: tpl.message,
            type: tpl.type,
            category: tpl.category,
          },
        });
      }
    }
  }

  console.log('Seed EMMANUEL SERVICES SARLU v3.0 Smart terminé.');
  console.log(`Comptes (${allUsers.length}) — mot de passe commun : password123`);
  for (const user of allUsers.sort((a, b) => a.email.localeCompare(b.email))) {
    console.log(`  ${user.email.padEnd(30)} ${user.role}`);
  }

  const { DEFAULT_ROLE_PERMISSIONS } = await import('../src/authorizations/acl.catalog');
  const resources = Object.keys(DEFAULT_ROLE_PERMISSIONS.ADMIN);
  for (const [role, matrix] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const resource of resources) {
      await prisma.rolePermission.upsert({
        where: { role_resource: { role: role as UserRole, resource } },
        create: { role: role as UserRole, resource, actions: matrix[resource] ?? [] },
        update: { actions: matrix[resource] ?? [] },
      });
    }
  }
  console.log(`Habilitations : ${resources.length} modules × ${Object.keys(DEFAULT_ROLE_PERMISSIONS).length} profils.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
