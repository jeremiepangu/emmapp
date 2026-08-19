import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

export interface CreateVehicleDto {
  plate: string;
  name: string;
  capacity?: number;
  fuelType?: string;
  co2FactorKgPerKm?: number;
}

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.vehicle.findMany({
      orderBy: { plate: 'asc' },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException('Véhicule introuvable');
    return vehicle;
  }

  create(dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        plate: dto.plate.trim().toUpperCase(),
        name: dto.name.trim(),
        capacity: dto.capacity ?? 100,
        fuelType: dto.fuelType ?? 'DIESEL',
        co2FactorKgPerKm: dto.co2FactorKgPerKm,
      },
    });
  }

  async update(id: string, dto: Partial<CreateVehicleDto> & { isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        plate: dto.plate?.trim().toUpperCase(),
        name: dto.name?.trim(),
        capacity: dto.capacity,
        fuelType: dto.fuelType,
        co2FactorKgPerKm: dto.co2FactorKgPerKm,
        isActive: dto.isActive,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: { isActive: false } });
  }
}
