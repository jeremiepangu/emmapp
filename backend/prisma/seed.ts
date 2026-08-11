import {
  PrismaClient,
  UserRole,
  ClientSegment,
  ProductFormat,
  StockLocationType,
  OrderStatus,
  TourStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@emmapp.cd' },
    update: {},
    create: {
      email: 'admin@emmapp.cd',
      passwordHash,
      firstName: 'Admin',
      lastName: 'EMMAPP',
      role: UserRole.ADMIN,
      phone: '+243900000001',
    },
  });

  const livreur = await prisma.user.upsert({
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
    where: { email: 'magasinier@emmapp.cd' },
    update: {},
    create: {
      email: 'magasinier@emmapp.cd',
      passwordHash,
      firstName: 'Marie',
      lastName: 'Kabongo',
      role: UserRole.MAGASINIER,
      phone: '+243900000003',
    },
  });

  const products = await Promise.all([
    prisma.product.upsert({
      where: { code: 'SACHET-500' },
      update: {},
      create: {
        code: 'SACHET-500',
        name: 'Eau sachet 500ml (pack 30)',
        format: ProductFormat.SACHET,
        unitPrice: 15000,
        consigneAmount: 0,
        isReusable: false,
      },
    }),
    prisma.product.upsert({
      where: { code: 'BTE-1.5L' },
      update: {},
      create: {
        code: 'BTE-1.5L',
        name: 'Bouteille 1,5 L (pack 12)',
        format: ProductFormat.BOUTEILLE,
        unitPrice: 12000,
        consigneAmount: 0,
        isReusable: false,
      },
    }),
    prisma.product.upsert({
      where: { code: 'BIDON-5L' },
      update: {},
      create: {
        code: 'BIDON-5L',
        name: 'Bidon 5 L réutilisable',
        format: ProductFormat.BIDON_5L,
        unitPrice: 2500,
        consigneAmount: 3000,
        isReusable: true,
      },
    }),
    prisma.product.upsert({
      where: { code: 'BONB-19L' },
      update: {},
      create: {
        code: 'BONB-19L',
        name: 'Bonbonne 19 L (5 gallons)',
        format: ProductFormat.BONBONNE_19L,
        unitPrice: 8000,
        consigneAmount: 15000,
        isReusable: true,
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
      name: 'Produits finis - Entrepôt principal',
      type: StockLocationType.PRODUITS_FINIS,
    },
  });

  const locVehicule = await prisma.stockLocation.upsert({
    where: { code: 'VEH-01' },
    update: {},
    create: {
      code: 'VEH-01',
      name: 'Stock embarqué - KIN-1234-AB',
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
      update: {},
      create: {
        code: 'CLI-001',
        name: 'Supermarché Kin Marché',
        segment: ClientSegment.SUPERMARCHE,
        address: 'Av. Lumumba, Gombe',
        city: 'Kinshasa',
        zone: 'Gombe',
        latitude: -4.3217,
        longitude: 15.312,
        phone: '+243810000001',
        creditLimit: 500000,
        consigneLimit: 100,
      },
    }),
    prisma.client.upsert({
      where: { code: 'CLI-002' },
      update: {},
      create: {
        code: 'CLI-002',
        name: 'Dépôt Maman Nana',
        segment: ClientSegment.DETAILLANT,
        address: 'Quartier Masina',
        city: 'Kinshasa',
        zone: 'Masina',
        latitude: -4.383,
        longitude: 15.391,
        phone: '+243810000002',
        creditLimit: 100000,
        consigneLimit: 50,
      },
    }),
    prisma.client.upsert({
      where: { code: 'CLI-003' },
      update: {},
      create: {
        code: 'CLI-003',
        name: 'Entreprise RawTech SARL',
        segment: ClientSegment.ENTREPRISE,
        address: 'Bandalungwa',
        city: 'Kinshasa',
        zone: 'Bandalungwa',
        phone: '+243810000003',
        creditLimit: 1000000,
        consigneLimit: 30,
      },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tour = await prisma.tour.create({
    data: {
      tourNumber: 'TR-DEMO-001',
      zone: 'Kinshasa Nord',
      date: today,
      driverId: livreur.id,
      vehicleId: vehicle.id,
      status: TourStatus.PLANIFIEE,
    },
  });

  for (const client of clients.slice(0, 2)) {
    const order = await prisma.order.create({
      data: {
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
    console.log(`Commande créée: ${order.orderNumber}`);
  }

  console.log('Seed terminé.');
  console.log('Comptes: admin@emmapp.cd / livreur@emmapp.cd / magasinier@emmapp.cd');
  console.log('Mot de passe: password123');
  console.log(`Admin ID: ${admin.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
