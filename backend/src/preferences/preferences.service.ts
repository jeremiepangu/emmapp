import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

export interface PanneauTableauBord {
  key: string;
  visible: boolean;
}

export interface PreferenceUtilisateur {
  theme: string;
  dashboardLayout?: PanneauTableauBord[];
}

const THEMES = ['clair', 'sombre'];

@Injectable()
export class PreferencesService {
  constructor(private prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<PreferenceUtilisateur> {
    const preference = await this.prisma.userPreference.findUnique({ where: { userId } });
    return {
      theme: preference?.theme ?? 'clair',
      dashboardLayout: this.lireLayout(preference?.dashboardLayout),
    };
  }

  async updatePreferences(
    userId: string,
    body: { theme?: string; dashboardLayout?: unknown },
  ): Promise<PreferenceUtilisateur> {
    if (body.theme !== undefined && !THEMES.includes(body.theme)) {
      throw new BadRequestException(`Thème invalide : ${THEMES.join(' ou ')} attendu.`);
    }

    const layout =
      body.dashboardLayout === undefined ? undefined : this.validerLayout(body.dashboardLayout);

    const layoutJson =
      layout === undefined ? undefined : (layout as unknown as Prisma.InputJsonValue);

    const preference = await this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: body.theme ?? 'clair',
        ...(layoutJson === undefined ? {} : { dashboardLayout: layoutJson }),
      },
      update: {
        ...(body.theme === undefined ? {} : { theme: body.theme }),
        ...(layoutJson === undefined ? {} : { dashboardLayout: layoutJson }),
      },
    });

    return {
      theme: preference.theme,
      dashboardLayout: this.lireLayout(preference.dashboardLayout),
    };
  }

  async findViews(userId: string, resource?: string) {
    const vues = await this.prisma.savedView.findMany({
      where: { userId, ...(resource ? { resource } : {}) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return vues.map((vue) => this.formaterVue(vue));
  }

  async createView(
    userId: string,
    body: { resource?: string; name?: string; filters?: unknown; isDefault?: boolean },
  ) {
    const resource = typeof body.resource === 'string' ? body.resource.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!resource || !name) {
      throw new BadRequestException('La ressource et le nom de la vue sont obligatoires.');
    }

    const filters =
      body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
        ? (body.filters as Record<string, unknown>)
        : {};
    const isDefault = body.isDefault === true;

    const vue = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.savedView.updateMany({
          where: { userId, resource, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.savedView.upsert({
        where: { userId_resource_name: { userId, resource, name } },
        create: {
          userId,
          resource,
          name,
          filters: filters as unknown as Prisma.InputJsonValue,
          isDefault,
        },
        update: { filters: filters as unknown as Prisma.InputJsonValue, isDefault },
      });
    });

    return this.formaterVue(vue);
  }

  async removeView(userId: string, id: string) {
    const { count } = await this.prisma.savedView.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundException('Vue sauvegardée introuvable.');
    }
  }

  private validerLayout(valeur: unknown): PanneauTableauBord[] {
    if (!Array.isArray(valeur)) {
      throw new BadRequestException('dashboardLayout doit être un tableau de panneaux.');
    }
    return valeur.map((element) => {
      const panneau = element as { key?: unknown; visible?: unknown };
      if (
        !element ||
        typeof element !== 'object' ||
        typeof panneau.key !== 'string' ||
        !panneau.key.trim() ||
        typeof panneau.visible !== 'boolean'
      ) {
        throw new BadRequestException(
          'Chaque panneau doit comporter une clé texte et une visibilité booléenne.',
        );
      }
      return { key: panneau.key, visible: panneau.visible };
    });
  }

  private lireLayout(valeur: Prisma.JsonValue | null | undefined): PanneauTableauBord[] | undefined {
    if (!Array.isArray(valeur)) return undefined;
    const panneaux = valeur.filter(
      (element): element is { key: string; visible: boolean } =>
        !!element &&
        typeof element === 'object' &&
        !Array.isArray(element) &&
        typeof (element as { key?: unknown }).key === 'string' &&
        typeof (element as { visible?: unknown }).visible === 'boolean',
    );
    return panneaux.map((panneau) => ({ key: panneau.key, visible: panneau.visible }));
  }

  private formaterVue(vue: {
    id: string;
    resource: string;
    name: string;
    filters: Prisma.JsonValue;
    isDefault: boolean;
    createdAt: Date;
  }) {
    return {
      id: vue.id,
      resource: vue.resource,
      name: vue.name,
      filters:
        vue.filters && typeof vue.filters === 'object' && !Array.isArray(vue.filters)
          ? (vue.filters as Record<string, unknown>)
          : {},
      isDefault: vue.isDefault,
      createdAt: vue.createdAt,
    };
  }
}
