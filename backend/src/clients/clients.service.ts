import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ClientSegment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  findAll(params?: { zone?: string; search?: string }) {
    const where: Prisma.ClientWhereInput = { isActive: true };
    if (params?.zone) where.zone = params.zone;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
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

  create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: dto });
  }

  update(id: string, dto: UpdateClientDto) {
    return this.prisma.client.update({ where: { id }, data: dto });
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
