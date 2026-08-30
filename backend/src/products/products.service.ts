import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationCategory, NotificationType, ProductFormat, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateProductDto {
  code: string;
  name: string;
  format: ProductFormat;
  unitPrice: number;
  consigneAmount?: number;
  isReusable?: boolean;
  /** Photo du produit, stockée en data URL (image redimensionnée côté client). */
  imageUrl?: string | null;
  maxRotations?: number;
  loyaltyPointsPerUnit?: number;
}

export type UpdateProductDto = Partial<CreateProductDto>;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

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

  async create(dto: CreateProductDto) {
    const created = await this.prisma.product.create({ data: dto });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_PRODUCTION, UserRole.COMMERCIAL],
      {
        title: 'Nouveau produit',
        message: `${created.code} — ${created.name}`,
        type: NotificationType.INFO,
        category: NotificationCategory.STOCK,
        link: '/products',
      },
    );
    return created;
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
