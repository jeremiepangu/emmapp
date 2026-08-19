import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockLocationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

export interface CreateStockLocationDto {
  code: string;
  name: string;
  type: StockLocationType;
  vehicleId?: string;
}

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
      include: { vehicle: { select: { id: true, plate: true, name: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createLocation(dto: CreateStockLocationDto) {
    return this.prisma.stockLocation.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        type: dto.type,
        vehicleId: dto.type === StockLocationType.VEHICULE ? dto.vehicleId : undefined,
      },
      include: { vehicle: { select: { id: true, plate: true, name: true } } },
    });
  }

  async updateLocation(id: string, dto: Partial<CreateStockLocationDto>) {
    const existing = await this.prisma.stockLocation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Emplacement introuvable');
    const type = dto.type ?? existing.type;
    return this.prisma.stockLocation.update({
      where: { id },
      data: {
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        type: dto.type,
        vehicleId: type === StockLocationType.VEHICULE ? (dto.vehicleId ?? existing.vehicleId) : null,
      },
      include: { vehicle: { select: { id: true, plate: true, name: true } } },
    });
  }

  async removeLocation(id: string) {
    const existing = await this.prisma.stockLocation.findUnique({
      where: { id },
      include: { _count: { select: { stockItems: true } } },
    });
    if (!existing) throw new NotFoundException('Emplacement introuvable');
    if (existing._count.stockItems > 0) {
      throw new BadRequestException('Impossible de supprimer : des stocks sont encore rattachés');
    }
    return this.prisma.stockLocation.delete({ where: { id } });
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

  setQuantity(id: string, quantity: number) {
    return this.prisma.stockItem.update({ where: { id }, data: { quantity } });
  }

  remove(id: string) {
    return this.prisma.stockItem.delete({ where: { id } });
  }
}
