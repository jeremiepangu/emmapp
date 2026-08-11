import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  getByLocation(locationId?: string) {
    return this.prisma.stockItem.findMany({
      where: locationId ? { locationId } : undefined,
      include: {
        product: true,
        location: true,
      },
    });
  }

  getLocations() {
    return this.prisma.stockLocation.findMany({
      include: { vehicle: true },
    });
  }

  getVehicleStock(vehicleId: string) {
    return this.prisma.stockItem.findMany({
      where: { location: { vehicleId } },
      include: { product: true, location: true },
    });
  }

  async adjustStock(
    productId: string,
    locationId: string,
    quantity: number,
    lotNumber?: string,
  ) {
    const existing = await this.prisma.stockItem.findFirst({
      where: { productId, locationId, lotNumber: lotNumber ?? null },
    });

    if (existing) {
      return this.prisma.stockItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    }

    return this.prisma.stockItem.create({
      data: { productId, locationId, quantity, lotNumber },
    });
  }
}
