import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PackagingKind, PackagingMovementType, PackagingPackFormat, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import {
  CreatePackagingMovementDto,
  CreatePackagingSkuDto,
  UpdatePackagingMovementDto,
  UpdatePackagingSkuDto,
} from './dto/packaging.dto';

const INBOUND: PackagingMovementType[] = [PackagingMovementType.ACHAT];

@Injectable()
export class PackagingService {
  constructor(private prisma: PrismaService) {}

  listSkus(kind?: PackagingKind, format?: PackagingPackFormat) {
    return this.prisma.packagingSku.findMany({
      where: { kind, format },
      include: { stock: true },
      orderBy: [{ kind: 'asc' }, { format: 'asc' }, { code: 'asc' }],
    });
  }

  async createSku(dto: CreatePackagingSkuDto) {
    return this.prisma.packagingSku.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        kind: dto.kind,
        format: dto.format,
        minStock: dto.minStock ?? 50,
        stock: { create: { quantity: 0 } },
      },
      include: { stock: true },
    });
  }

  async updateSku(id: string, dto: UpdatePackagingSkuDto) {
    const sku = await this.prisma.packagingSku.findUnique({ where: { id } });
    if (!sku) throw new NotFoundException('Article d\'emballage introuvable');
    return this.prisma.packagingSku.update({
      where: { id },
      data: {
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        kind: dto.kind,
        format: dto.format,
        minStock: dto.minStock,
        isActive: dto.isActive,
      },
      include: { stock: true },
    });
  }

  async deactivateSku(id: string) {
    const sku = await this.prisma.packagingSku.findUnique({ where: { id } });
    if (!sku) throw new NotFoundException('Article d\'emballage introuvable');
    return this.prisma.packagingSku.update({
      where: { id },
      data: { isActive: false },
      include: { stock: true },
    });
  }

  async summary() {
    const skus = await this.prisma.packagingSku.findMany({
      where: { isActive: true },
      include: { stock: true },
    });
    const byKind = (kind: PackagingKind) => {
      const rows = skus.filter((s) => s.kind === kind);
      const quantity = rows.reduce((sum, s) => sum + (s.stock?.quantity ?? 0), 0);
      const lowStock = rows.filter((s) => (s.stock?.quantity ?? 0) < s.minStock).length;
      return { kind, quantity, skuCount: rows.length, lowStock };
    };
    return {
      EMBALLAGE: byKind(PackagingKind.EMBALLAGE),
      ETIQUETTE: byKind(PackagingKind.ETIQUETTE),
      BOUCHON: byKind(PackagingKind.BOUCHON),
    };
  }

  listMovements(filters: {
    kind?: PackagingKind;
    format?: PackagingPackFormat;
    type?: PackagingMovementType;
    skuId?: string;
  }) {
    return this.prisma.packagingMovement.findMany({
      where: {
        type: filters.type,
        skuId: filters.skuId,
        sku: {
          kind: filters.kind,
          format: filters.format,
        },
      },
      include: {
        sku: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  async recordMovement(dto: CreatePackagingMovementDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sku = await tx.packagingSku.findUnique({
        where: { id: dto.skuId },
        include: { stock: true },
      });
      if (!sku || !sku.isActive) {
        throw new NotFoundException('Article d\'emballage introuvable');
      }

      const inbound = INBOUND.includes(dto.type);
      const delta = inbound ? dto.quantity : -dto.quantity;
      const current = sku.stock?.quantity ?? 0;
      const next = current + delta;
      if (next < 0) {
        throw new BadRequestException(
          `Stock insuffisant pour ${sku.name} (disponible : ${current})`,
        );
      }

      if (sku.stock) {
        await tx.packagingStock.update({
          where: { id: sku.stock.id },
          data: { quantity: next },
        });
      } else {
        await tx.packagingStock.create({
          data: { skuId: sku.id, quantity: next },
        });
      }

      return tx.packagingMovement.create({
        data: {
          skuId: sku.id,
          type: dto.type,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          supplier: dto.supplier?.trim() || undefined,
          reference: dto.reference?.trim() || undefined,
          notes: dto.notes?.trim() || undefined,
          createdById: userId,
        },
        include: {
          sku: { include: { stock: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      });
    });
  }

  async removeMovement(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.packagingMovement.findUnique({
        where: { id },
        include: { sku: { include: { stock: true } } },
      });
      if (!movement) throw new NotFoundException('Mouvement introuvable');

      const inbound = INBOUND.includes(movement.type);
      const delta = inbound ? -movement.quantity : movement.quantity;
      const current = movement.sku.stock?.quantity ?? 0;
      const next = current + delta;
      if (next < 0) {
        throw new BadRequestException('Impossible d\'annuler : le stock redeviendrait négatif');
      }

      if (movement.sku.stock) {
        await tx.packagingStock.update({
          where: { id: movement.sku.stock.id },
          data: { quantity: next },
        });
      }

      return tx.packagingMovement.delete({ where: { id } });
    });
  }

  async updateMovement(id: string, dto: UpdatePackagingMovementDto) {
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.packagingMovement.findUnique({
        where: { id },
        include: { sku: { include: { stock: true } } },
      });
      if (!movement) throw new NotFoundException('Mouvement introuvable');

      const nextSkuId = dto.skuId ?? movement.skuId;
      const nextType = dto.type ?? movement.type;
      const nextQty = dto.quantity ?? movement.quantity;

      const reverseInbound = INBOUND.includes(movement.type);
      const reverseDelta = reverseInbound ? -movement.quantity : movement.quantity;
      await this.applyDelta(tx, movement.skuId, reverseDelta);

      const inbound = INBOUND.includes(nextType);
      const applyDelta = inbound ? nextQty : -nextQty;
      await this.applyDelta(tx, nextSkuId, applyDelta);

      return tx.packagingMovement.update({
        where: { id },
        data: {
          skuId: nextSkuId,
          type: nextType,
          quantity: nextQty,
          unitCost: dto.unitCost,
          supplier: dto.supplier?.trim() || undefined,
          reference: dto.reference?.trim() || undefined,
          notes: dto.notes?.trim() || undefined,
        },
        include: {
          sku: { include: { stock: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      });
    });
  }

  private async applyDelta(tx: Prisma.TransactionClient, skuId: string, delta: number) {
    const sku = await tx.packagingSku.findUnique({
      where: { id: skuId },
      include: { stock: true },
    });
    if (!sku) throw new NotFoundException('Article d\'emballage introuvable');
    const current = sku.stock?.quantity ?? 0;
    const next = current + delta;
    if (next < 0) {
      throw new BadRequestException(
        `Stock insuffisant pour ${sku.name} (disponible : ${current})`,
      );
    }
    if (sku.stock) {
      await tx.packagingStock.update({
        where: { id: sku.stock.id },
        data: { quantity: next },
      });
    } else {
      await tx.packagingStock.create({
        data: { skuId: sku.id, quantity: next },
      });
    }
  }
}
