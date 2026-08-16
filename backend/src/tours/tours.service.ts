import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TourStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { CreateTourDto } from './dto/tour.dto';

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
  constructor(private prisma: PrismaService) {}

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
      },
    });
    if (!tour) throw new NotFoundException('Tournée introuvable');
    return tour;
  }

  async create(dto: CreateTourDto) {
    return this.prisma.tour.create({
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
      await this.prisma.tour.update({
        where: { id: tourId },
        data: { status: TourStatus.EN_COURS, startedAt: new Date() },
      });
    }

    return sheet;
  }

  async startTour(id: string) {
    return this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.EN_COURS, startedAt: new Date() },
    });
  }

  async completeTour(id: string) {
    return this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.TERMINEE, completedAt: new Date() },
    });
  }

  async cancelTour(id: string) {
    const tour = await this.findOne(id);
    if (tour.status === TourStatus.TERMINEE) {
      throw new BadRequestException('Tournée déjà terminée');
    }
    return this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.ANNULEE },
    });
  }
}
