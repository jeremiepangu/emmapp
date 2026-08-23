import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ClientSegment, NotificationCategory, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  findAll(params?: { zone?: string; search?: string }) {
    const where: Prisma.ClientWhereInput = { isActive: true };
    if (params?.zone) where.zone = params.zone;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
        { commune: { contains: params.search, mode: 'insensitive' } },
        { quartier: { contains: params.search, mode: 'insensitive' } },
        { avenue: { contains: params.search, mode: 'insensitive' } },
        { idDocumentNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        consignes: { orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!client) throw new NotFoundException('Client introuvable');
    return client;
  }

  async create(dto: CreateClientDto) {
    const created = await this.prisma.client.create({
      data: this.normalizeIdentity(dto) as Prisma.ClientUncheckedCreateInput,
    });
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.COMMERCIAL],
      {
        title: 'Nouveau client',
        message: `${created.code} — ${created.name}`,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.SYSTEME,
        link: '/clients',
      },
    );
    return created;
  }

  update(id: string, dto: UpdateClientDto) {
    return this.prisma.client.update({
      where: { id },
      data: this.normalizeIdentity(dto) as Prisma.ClientUncheckedUpdateInput,
    });
  }

  private normalizeIdentity(dto: CreateClientDto | UpdateClientDto) {
    const province = dto.province?.trim() || 'KINSHASA';
    const avenueLine = [dto.avenue, dto.avenueNumber].filter(Boolean).join(' ').trim();
    const address =
      dto.address?.trim() ||
      [avenueLine, dto.quartier, dto.commune, dto.district, province].filter(Boolean).join(', ') ||
      undefined;
    return {
      ...dto,
      province,
      city: dto.city?.trim() || 'Kinshasa',
      zone: dto.zone?.trim() || dto.commune || undefined,
      address,
      logoUrl: dto.logoUrl?.trim() || undefined,
    };
  }

  async deactivate(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client introuvable');
    return this.prisma.client.update({ where: { id }, data: { isActive: false } });
  }

  getConsigneBalance(id: string) {
    return this.prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        consigneBalance: true,
        consigneLimit: true,
      },
    });
  }
}
