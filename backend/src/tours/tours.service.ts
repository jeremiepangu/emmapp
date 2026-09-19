import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationCategory, NotificationType, TourStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTourDto, FieldTourDto, RecordTourUnsoldDto, UpdateTourDto } from './dto/tour.dto';

/** Champs du livreur exposables par l'API : exclut l'empreinte du mot de passe. */
const DRIVER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
} as const;

@Injectable()
export class ToursService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async generateTourNumber(): Promise<string> {
    const count = await this.prisma.tour.count();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `TR-${date}-${String(count + 1).padStart(3, '0')}`;
  }

  findAll(params?: { date?: string; driverId?: string; status?: TourStatus }) {
    return this.prisma.tour.findMany({
      where: {
        date: params?.date ? new Date(params.date) : undefined,
        driverId: params?.driverId,
        status: params?.status,
      },
      include: {
        driver: { select: DRIVER_SELECT },
        vehicle: true,
        orders: { include: { client: true, lines: { include: { product: true } } } },
        loadSheets: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      include: {
        driver: { select: DRIVER_SELECT },
        vehicle: true,
        orders: {
          include: {
            client: true,
            lines: { include: { product: true } },
          },
        },
        deliveries: {
          include: { client: true, lines: { include: { product: true } } },
        },
        loadSheets: true,
        unsoldLines: { include: { product: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!tour) throw new NotFoundException('Tournée introuvable');
    return tour;
  }

  async create(dto: CreateTourDto) {
    const created = await this.prisma.tour.create({
      data: {
        tourNumber: await this.generateTourNumber(),
        zone: dto.zone,
        date: new Date(dto.date),
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        status: TourStatus.PLANIFIEE,
        orders: dto.orderIds?.length
          ? { connect: dto.orderIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        driver: { select: DRIVER_SELECT },
        vehicle: true,
        orders: true,
      },
    });
    await this.notifyTour(created, 'Tournee planifiee', NotificationType.INFO);
    return created;
  }

  /** Demarrage autonome par le livreur sans commandes pre-planifiees. */
  async startFieldTour(driverId: string, dto: FieldTourDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicule introuvable');
    const today = dto.date ? new Date(dto.date) : new Date();
    const zone = dto.zone?.trim() || vehicle.plate || vehicle.name || 'Terrain';
    const created = await this.prisma.tour.create({
      data: {
        tourNumber: await this.generateTourNumber(),
        zone,
        date: today,
        driverId,
        vehicleId: dto.vehicleId,
        status: TourStatus.EN_COURS,
        startedAt: new Date(),
      },
      include: {
        driver: { select: DRIVER_SELECT },
        vehicle: true,
        orders: true,
      },
    });
    await this.notifyTour(created, 'Tournee terrain demarree', NotificationType.INFO);
    return created;
  }

  async listUnsold(tourId: string) {
    await this.findOne(tourId);
    return this.prisma.tourUnsoldLine.findMany({
      where: { tourId },
      include: { product: { select: { id: true, code: true, name: true, format: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordUnsold(tourId: string, dto: RecordTourUnsoldDto, recordedById: string) {
    const tour = await this.findOne(tourId);
    if (tour.status === TourStatus.TERMINEE || tour.status === TourStatus.ANNULEE) {
      throw new BadRequestException('Tournée clôturée ou annulée');
    }
    if (!dto.lines.length) {
      throw new BadRequestException('Aucune ligne invendue');
    }
    const created = await this.prisma.$transaction(
      dto.lines.map((line) => this.prisma.tourUnsoldLine.create({
        data: {
          tourId,
          productId: line.productId,
          quantity: line.quantity,
          notes: line.notes?.trim() || null,
          recordedById,
        },
        include: { product: { select: { id: true, code: true, name: true } } },
      })),
    );
    await this.notifyTour(tour, 'Invendus enregistres', NotificationType.WARNING);
    return created;
  }

  async createLoadSheet(tourId: string, items: unknown[]) {
    const tour = await this.findOne(tourId);
    if (tour.status === TourStatus.TERMINEE) {
      throw new BadRequestException('Tournée déjà terminée');
    }

    return this.prisma.loadSheet.create({
      data: {
        tourId,
        items: items as object,
      },
    });
  }

  async validateLoadSheet(
    tourId: string,
    loadSheetId: string,
    role: 'store' | 'driver',
  ) {
    const data =
      role === 'store'
        ? { validatedByStore: true }
        : { validatedByDriver: true };

    const sheet = await this.prisma.loadSheet.update({
      where: { id: loadSheetId },
      data,
    });

    if (sheet.validatedByStore && sheet.validatedByDriver) {
      const tour = await this.prisma.tour.update({
        where: { id: tourId },
        data: { status: TourStatus.EN_COURS, startedAt: new Date() },
      });
      await this.notifyTour(tour, 'Feuille de charge validee', NotificationType.SUCCESS);
    }

    return sheet;
  }

  async startTour(id: string) {
    const tour = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.EN_COURS, startedAt: new Date() },
    });
    await this.notifyTour(tour, 'Tournee demarree', NotificationType.INFO);
    return tour;
  }

  async completeTour(id: string) {
    const tour = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.TERMINEE, completedAt: new Date() },
    });
    await this.notifyTour(tour, 'Tournee terminee', NotificationType.SUCCESS);
    return tour;
  }

  async cancelTour(id: string) {
    const tour = await this.findOne(id);
    if (tour.status === TourStatus.TERMINEE) {
      throw new BadRequestException('Tournée déjà terminée');
    }
    const updated = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.ANNULEE },
    });
    await this.notifyTour(updated, 'Tournee annulee', NotificationType.WARNING);
    return updated;
  }

  async update(id: string, dto: UpdateTourDto) {
    const tour = await this.findOne(id);
    if (tour.status !== TourStatus.PLANIFIEE) {
      throw new BadRequestException('Seule une tournée planifiée peut être modifiée');
    }
    return this.prisma.tour.update({
      where: { id },
      data: {
        zone: dto.zone,
        date: dto.date ? new Date(dto.date) : undefined,
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        orders: dto.orderIds ? { set: dto.orderIds.map((orderId) => ({ id: orderId })) } : undefined,
      },
      include: {
        driver: { select: DRIVER_SELECT },
        vehicle: true,
        orders: { include: { client: true, lines: { include: { product: true } } } },
      },
    });
  }

  async remove(id: string) {
    const tour = await this.findOne(id);
    if (tour.status !== TourStatus.PLANIFIEE) {
      throw new BadRequestException('Seule une tournée planifiée peut être supprimée');
    }
    if (tour.deliveries.length > 0) {
      throw new BadRequestException('Impossible de supprimer : des livraisons sont rattachées');
    }
    await this.prisma.$transaction([
      this.prisma.loadSheet.deleteMany({ where: { tourId: id } }),
      this.prisma.optimizedRoute.deleteMany({ where: { tourId: id } }),
      this.prisma.esgIndicator.deleteMany({ where: { tourId: id } }),
      this.prisma.tour.update({ where: { id }, data: { orders: { set: [] } } }),
      this.prisma.tour.delete({ where: { id } }),
    ]);
    return { id };
  }

  private async notifyTour(
    tour: { tourNumber: string; zone: string; driverId?: string | null },
    title: string,
    type: NotificationType,
  ) {
    const payload = {
      title,
      message: `${tour.tourNumber} — ${tour.zone}`,
      type,
      category: NotificationCategory.TOURNEE,
      link: '/tours',
    };
    if (tour.driverId) {
      await this.notifications.create({ ...payload, userId: tour.driverId });
    }
    await this.notifications.notifyRoles(
      [UserRole.ADMIN, UserRole.CHEF_EXPLOITATION, UserRole.CHARGE_EXPLOITATION],
      payload,
    );
  }
}
