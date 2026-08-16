import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { lastName: 'asc' },
    });
  }

  findByRole(role: string) {
    return this.prisma.user.findMany({
      where: { role: role as never, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  }

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      role: UserRole;
      isActive: boolean;
      password: string;
    }>,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}
