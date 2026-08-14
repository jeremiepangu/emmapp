import {
  PrismaClient,
  UserRole,
  ClientSegment,
  ProductFormat,
  StockLocationType,
  OrderStatus,
  TourStatus,
  LoyaltyTier,
  ProductionOrderStatus,
  LotStatus,
  QualityCheckStatus,
  NotificationCategory,
  NotificationType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@emmapure.cd' },
    update: { firstName: 'Admin', lastName: 'EMMAPURE', role: UserRole.ADMIN },
    create: {
      email: 'admin@emmapure.cd',
      passwordHash,
      firstName: 'Admin',
      lastName: 'EMMAPURE',
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
      lastName: 'EMMAPURE',
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

  await prisma.user.upsert({
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

  const chefExploit = await prisma.user.findUnique({ where: { email: 'chef.exploit@emmapure.cd' } });
  void commercial;
  void magasinier;
  void chefExploit;

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

  const vehicle = await prisma.vehicle.upsert({
    where: { plate: 'KIN-1234-AB' },
    update: {},
    create: {
      plate: 'KIN-1234-AB',
      name: 'Camionnette Zone Nord',
      capacity: 200,
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
      update: { segment: ClientSegment.SUPERMARCHE, loyaltyTier: LoyaltyTier.OR },
      create: {
        code: 'CLI-001',
        name: 'Supermarché Kin Marché',
        segment: ClientSegment.SUPERMARCHE,
        address: 'Av. Lumumba, Gombe',
        city: 'Kinshasa',
        zone: 'Gombe',
        phone: '+243810000001',
        creditLimit: 500000,
        consigneLimit: 100,
        loyaltyPoints: 320,
        loyaltyTier: LoyaltyTier.OR,
      },
    }),
    prisma.client.upsert({
      where: { code: 'CLI-002' },
      update: { segment: ClientSegment.BOUTIQUE },
      create: {
        code: 'CLI-002',
        name: 'Boutique Maman Nana',
        segment: ClientSegment.BOUTIQUE,
        address: 'Quartier Masina',
        city: 'Kinshasa',
        zone: 'Masina',
        phone: '+243810000002',
        creditLimit: 100000,
        consigneLimit: 50,
        loyaltyPoints: 85,
        loyaltyTier: LoyaltyTier.BRONZE,
      },
    }),
    prisma.client.upsert({
      where: { code: 'CLI-003' },
      update: { segment: ClientSegment.HOTEL_RESTAURANT },
      create: {
        code: 'CLI-003',
        name: 'Hôtel RawTech & Restaurant',
        segment: ClientSegment.HOTEL_RESTAURANT,
        address: 'Bandalungwa',
        city: 'Kinshasa',
        zone: 'Bandalungwa',
        phone: '+243810000003',
        creditLimit: 1000000,
        consigneLimit: 30,
        loyaltyPoints: 150,
        loyaltyTier: LoyaltyTier.ARGENT,
      },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tour = await prisma.tour.upsert({
    where: { tourNumber: 'TR-DEMO-001' },
    update: {},
    create: {
      tourNumber: 'TR-DEMO-001',
      zone: 'Kinshasa Nord',
      date: today,
      driverId: livreur.id,
      vehicleId: vehicle.id,
      status: TourStatus.PLANIFIEE,
    },
  });

  for (const client of clients.slice(0, 2)) {
    await prisma.order.upsert({
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
    });
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

  await prisma.shiftAssignment.createMany({
    data: [
      {
        userId: livreur.id,
        date: today,
        startTime: '07:00',
        endTime: '09:30',
        postLabel: 'Agent chargeur',
      },
      {
        userId: livreur.id,
        date: today,
        startTime: '14:00',
        endTime: '17:00',
        postLabel: 'Chargé de livraison',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.packagingUnit.createMany({
    data: [
      { barcode: 'BB19-00001', productFormat: ProductFormat.BONBONNE_19L, rotationCount: 12, maxRotations: 50 },
      { barcode: 'BD10-00042', productFormat: ProductFormat.BIDON_10L, rotationCount: 22, maxRotations: 25 },
      { barcode: 'BD25-00008', productFormat: ProductFormat.BIDON_25L, rotationCount: 38, maxRotations: 40, status: 'ALERTE' },
    ],
    skipDuplicates: true,
  });

  await prisma.fountainAsset.createMany({
    data: [
      { serialNumber: 'FNT-2024-001', clientId: clients[2].id, model: 'Fontaine FR-200', contractType: 'LOCATION' },
    ],
    skipDuplicates: true,
  });

  const allUsers = await prisma.user.findMany({ where: { isActive: true } });
  const notifTemplates: Array<{
    roles: UserRole[];
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
  }> = [
    { roles: [UserRole.ADMIN, UserRole.DG], title: 'Supervision système', message: 'Tous les services EMMAS sont opérationnels.', type: NotificationType.SUCCESS, category: NotificationCategory.SYSTEME },
    { roles: [UserRole.CHEF_PRODUCTION, UserRole.ADMIN], title: 'OF en cours', message: 'Lot EMMA 5L — ligne L1 en production.', type: NotificationType.INFO, category: NotificationCategory.PRODUCTION },
    { roles: [UserRole.RESP_QUALITE, UserRole.ADMIN], title: 'Contrôle qualité en attente', message: 'Validation HACCP requise pour le lot du jour.', type: NotificationType.WARNING, category: NotificationCategory.QUALITE },
    { roles: [UserRole.CHEF_EXPLOITATION, UserRole.MAGASINIER], title: 'Tournée planifiée', message: 'Tournée Bandalungwa — chargement à prévoir.', type: NotificationType.INFO, category: NotificationCategory.TOURNEE },
    { roles: [UserRole.LIVREUR, UserRole.CHARGE_LIVRAISON], title: 'Livraison assignée', message: '3 commandes sur votre tournée du jour.', type: NotificationType.INFO, category: NotificationCategory.LIVRAISON },
    { roles: [UserRole.COMMERCIAL, UserRole.DELEGUE_COMMERCIAL], title: 'Commande validée', message: 'Supermarché Kin Marché — commande prête.', type: NotificationType.SUCCESS, category: NotificationCategory.COMMANDE },
    { roles: [UserRole.CAISSIER, UserRole.COMPTABLE], title: 'Encaissement', message: 'Paiements mobile money à rapprocher.', type: NotificationType.INFO, category: NotificationCategory.PAIEMENT },
    { roles: [UserRole.MAGASINIER], title: 'Stock bas', message: 'EMMA 5L — seuil minimum atteint.', type: NotificationType.ALERT, category: NotificationCategory.STOCK },
    { roles: [UserRole.RH], title: 'Planning RH', message: '2 affectations en attente de validation.', type: NotificationType.WARNING, category: NotificationCategory.RH },
    { roles: [UserRole.IT_GED, UserRole.SUPERVISEUR], title: 'Supervision', message: '1 sync mobile en attente.', type: NotificationType.WARNING, category: NotificationCategory.SUPERVISION },
  ];

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

  console.log('Seed EMMAS / EMMAPURE v2.1 terminé.');
  console.log('Comptes: admin@emmapure.cd / commercial@emmapure.cd / livreur@emmapure.cd — password123');
  console.log('(Compatibles: admin@emmapp.cd / livreur@emmapp.cd)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
