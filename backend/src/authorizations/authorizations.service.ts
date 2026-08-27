import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import {
  ACL_ACTIONS,
  ACL_RESOURCES,
  AclAction,
  AclMatrix,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABELS,
  allRoles,
  defaultMatrixFor,
  sanitizeRoleMatrix,
} from './acl.catalog';

@Injectable()
export class AuthorizationsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async ensureDefaults() {
    const count = await this.prisma.rolePermission.count();
    if (count === 0) {
      await this.resetAllRoles();
      return;
    }
    const existing = await this.prisma.rolePermission.findMany({ select: { role: true, resource: true } });
    const have = new Set(existing.map((row) => `${row.role}:${row.resource}`));
    for (const role of allRoles()) {
      const matrix = defaultMatrixFor(role);
      for (const resource of ACL_RESOURCES) {
        if (have.has(`${role}:${resource.id}`)) continue;
        await this.prisma.rolePermission.create({
          data: { role, resource: resource.id, actions: matrix[resource.id] ?? [] },
        });
      }
    }
  }

  catalog() {
    return {
      actions: ACL_ACTIONS,
      resources: ACL_RESOURCES,
      roles: allRoles().map((role) => ({ id: role, label: ROLE_LABELS[role] ?? role })),
    };
  }

  async matrix() {
    await this.ensureDefaults();
    const rows = await this.prisma.rolePermission.findMany();
    const byRole: Record<string, AclMatrix> = {};
    for (const role of allRoles()) {
      byRole[role] = defaultMatrixFor(role);
    }
    for (const row of rows) {
      byRole[row.role] = byRole[row.role] ?? {};
      byRole[row.role][row.resource] = row.actions as AclAction[];
    }
    return byRole;
  }

  async saveRole(role: UserRole, matrix: AclMatrix) {
    const clean = sanitizeRoleMatrix(role, matrix);
    await this.prisma.$transaction(
      ACL_RESOURCES.map((resource) =>
        this.prisma.rolePermission.upsert({
          where: { role_resource: { role, resource: resource.id } },
          create: { role, resource: resource.id, actions: clean[resource.id] ?? [] },
          update: { actions: clean[resource.id] ?? [] },
        }),
      ),
    );
    return { role, matrix: clean };
  }

  async resetRole(role: UserRole) {
    return this.saveRole(role, defaultMatrixFor(role));
  }

  async resetAllRoles() {
    for (const role of allRoles()) {
      const matrix = defaultMatrixFor(role);
      for (const resource of ACL_RESOURCES) {
        await this.prisma.rolePermission.upsert({
          where: { role_resource: { role, resource: resource.id } },
          create: { role, resource: resource.id, actions: matrix[resource.id] ?? [] },
          update: { actions: matrix[resource.id] ?? [] },
        });
      }
    }
    return this.matrix();
  }

  async userOverrides(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const overrides = await this.prisma.userPermission.findMany({
      where: { userId },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
    return { user, overrides, effective: await this.effectiveMatrix(userId, user.role) };
  }

  async saveUserOverrides(
    userId: string,
    overrides: Array<{ resource: string; action: AclAction; effect: 'GRANT' | 'DENY' }>,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.prisma.$transaction([
      this.prisma.userPermission.deleteMany({ where: { userId } }),
      ...overrides
        .filter((row) => ACL_ACTIONS.some((a) => a.id === row.action) && ACL_RESOURCES.some((r) => r.id === row.resource))
        .map((row) =>
          this.prisma.userPermission.create({
            data: {
              userId,
              resource: row.resource,
              action: row.action,
              effect: row.effect === 'DENY' ? 'DENY' : 'GRANT',
            },
          }),
        ),
    ]);
    return this.userOverrides(userId);
  }

  async effectiveMatrix(userId: string, role: string): Promise<AclMatrix> {
    const base = { ...(await this.roleMatrix(role as UserRole)) };
    if (role === 'ADMIN') return sanitizeRoleMatrix('ADMIN', { ...DEFAULT_ROLE_PERMISSIONS.ADMIN, ...base });
    const overrides = await this.prisma.userPermission.findMany({ where: { userId } });
    for (const row of overrides) {
      const current = new Set(base[row.resource] ?? []);
      if (row.effect === 'DENY') current.delete(row.action as AclAction);
      else current.add(row.action as AclAction);
      if ([...current].some((a) => a !== 'read')) current.add('read');
      base[row.resource] = [...current] as AclAction[];
    }
    return base;
  }

  async roleMatrix(role: UserRole): Promise<AclMatrix> {
    const rows = await this.prisma.rolePermission.findMany({ where: { role } });
    if (!rows.length) return defaultMatrixFor(role);
    const matrix: AclMatrix = { ...defaultMatrixFor(role) };
    for (const row of rows) {
      matrix[row.resource] = row.actions as AclAction[];
    }
    return matrix;
  }

  async can(userId: string, role: string, resource: string, action: AclAction): Promise<boolean> {
    if (role === 'ADMIN') return true;
    const matrix = await this.effectiveMatrix(userId, role);
    return (matrix[resource] ?? []).includes(action);
  }

  async mine(userId: string, role: string) {
    return {
      role,
      matrix: await this.effectiveMatrix(userId, role),
    };
  }
}
