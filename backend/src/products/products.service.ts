import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

export interface CreateProductDto {
  code: string;
  name: string;
  format: ProductFormat;
  unitPrice: number;
  consigneAmount?: number;
  isReusable?: boolean;
  maxRotations?: number;
  loyaltyPointsPerUnit?: number;
}

export type UpdateProductDto = Partial<CreateProductDto>;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
