import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AttendancePunchType,
  AttendanceSource,
  LeaveStatus,
  PresenceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { AdjustAttendanceDayDto, AttendancePunchDto, ManualPunchDto } from './dto/attendance.dto';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  email: true,
} as const;

function parseDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('Date invalide');
  }
  const day = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(day);
  end.setUTCDate(end.getUTCDate() + 1);
  return { day, end };
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async punch(userId: string, dto: AttendancePunchDto) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const { day, end } = parseDay(today);

    const last = await this.prisma.attendancePunch.findFirst({
      where: { userId, punchedAt: { gte: day, lt: end }, cancelledAt: null },
      orderBy: { punchedAt: 'desc' },
    });

    if (dto.type === AttendancePunchType.ENTREE) {
      if (last && last.type !== AttendancePunchType.SORTIE && last.type !== AttendancePunchType.PAUSE_FIN) {
        throw new BadRequestException('Une entree est deja en cours');
      }
    } else if (dto.type === AttendancePunchType.SORTIE) {
      if (!last || (last.type !== AttendancePunchType.ENTREE && last.type !== AttendancePunchType.PAUSE_FIN)) {
        throw new BadRequestException('Pointez votre entree avant la sortie');
      }
    } else if (dto.type === AttendancePunchType.PAUSE_DEBUT) {
      if (!last || last.type !== AttendancePunchType.ENTREE) {
        throw new BadRequestException('Impossible de demarrer une pause');
      }
    } else if (dto.type === AttendancePunchType.PAUSE_FIN) {
      if (!last || last.type !== AttendancePunchType.PAUSE_DEBUT) {
        throw new BadRequestException('Aucune pause en cours');
      }
    }

    const shift = await this.prisma.shiftAssignment.findFirst({
      where: { userId, date: day },
      orderBy: { createdAt: 'desc' },
    });

    const punch = await this.prisma.attendancePunch.create({
      data: {
        userId,
        punchedAt: now,
        type: dto.type,
        source: dto.source ?? AttendanceSource.MOBILE,
        shiftId: shift?.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        notes: dto.notes?.trim() || null,
      },
    });

    const summary = await this.recomputeDay(userId, today);
    return { punch, summary };
  }

  async manualPunch(actorId: string, dto: ManualPunchDto) {
    const punchedAt = dto.punchedAt ? new Date(dto.punchedAt) : new Date();
    const date = punchedAt.toISOString().slice(0, 10);
    const shift = await this.prisma.shiftAssignment.findFirst({
      where: { userId: dto.userId, date: parseDay(date).day },
      orderBy: { createdAt: 'desc' },
    });
    const punch = await this.prisma.attendancePunch.create({
      data: {
        userId: dto.userId,
        punchedAt,
        type: dto.type,
        source: dto.source ?? AttendanceSource.MANUEL,
        shiftId: shift?.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        notes: dto.notes?.trim() || null,
      },
    });
    const summary = await this.recomputeDay(dto.userId, date, actorId);
    return { punch, summary };
  }

  async myStatus(userId: string, date?: string) {
    const d = date || new Date().toISOString().slice(0, 10);
    const { day, end } = parseDay(d);
    const [punches, dayRow, shift, onLeave] = await Promise.all([
      this.prisma.attendancePunch.findMany({
        where: { userId, punchedAt: { gte: day, lt: end }, cancelledAt: null },
        orderBy: { punchedAt: 'asc' },
      }),
      this.prisma.attendanceDay.findUnique({
        where: { userId_date: { userId, date: day } },
      }),
      this.prisma.shiftAssignment.findFirst({ where: { userId, date: day } }),
      this.prisma.leaveRequest.findFirst({
        where: {
          userId,
          status: LeaveStatus.VALIDEE,
          startDate: { lte: day },
          endDate: { gte: day },
        },
      }),
    ]);
    const open = punches.length > 0
      && punches[punches.length - 1].type !== AttendancePunchType.SORTIE;
    return {
      date: d,
      punches,
      day: dayRow,
      shift,
      onLeave: Boolean(onLeave),
      canPunchIn: !onLeave && (!punches.length || !open),
      canPunchOut: !onLeave && open,
    };
  }

  async overview(date: string, department?: string) {
    const { day } = parseDay(date);
    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        status: 'ACTIF',
        ...(department ? { department } : {}),
      },
      include: { user: { select: USER_SELECT } },
      orderBy: [{ department: 'asc' }, { user: { lastName: 'asc' } }],
    });

    const userIds = employees.map((e) => e.userId);
    const days = await this.prisma.attendanceDay.findMany({
      where: { userId: { in: userIds }, date: day },
    });
    const dayByUser = new Map(days.map((d) => [d.userId, d]));

    const rows = employees.map((emp) => {
      const row = dayByUser.get(emp.userId);
      return {
        user: emp.user,
        department: emp.department,
        jobTitle: emp.jobTitle,
        status: row?.status ?? PresenceStatus.INCOMPLET,
        plannedMinutes: row?.plannedMinutes ?? 0,
        workedMinutes: row?.workedMinutes ?? 0,
        overtimeMinutes: row?.overtimeMinutes ?? 0,
        lateMinutes: row?.lateMinutes ?? 0,
        firstInAt: row?.firstInAt ?? null,
        lastOutAt: row?.lastOutAt ?? null,
        dayId: row?.id ?? null,
      };
    });

    return {
      date,
      totals: {
        agents: rows.length,
        present: rows.filter((r) => r.status === PresenceStatus.PRESENT || r.status === PresenceStatus.RETARD).length,
        late: rows.filter((r) => r.lateMinutes > 0).length,
        absent: rows.filter((r) => r.status === PresenceStatus.ABSENT).length,
        onLeave: rows.filter((r) => r.status === PresenceStatus.CONGE).length,
        workedMinutes: rows.reduce((s, r) => s + r.workedMinutes, 0),
        overtimeMinutes: rows.reduce((s, r) => s + r.overtimeMinutes, 0),
      },
      rows,
    };
  }

  async timesheet(from: string, to: string, userId?: string) {
    const start = parseDay(from).day;
    const end = parseDay(to).end;
    const where: Prisma.AttendanceDayWhereInput = {
      date: { gte: start, lt: end },
      ...(userId ? { userId } : {}),
    };
    const rows = await this.prisma.attendanceDay.findMany({
      where,
      include: { user: { select: USER_SELECT } },
      orderBy: [{ date: 'asc' }, { user: { lastName: 'asc' } }],
    });
    const totals = rows.reduce(
      (acc, r) => {
        acc.workedMinutes += r.workedMinutes;
        acc.overtimeMinutes += r.overtimeMinutes;
        acc.plannedMinutes += r.plannedMinutes;
        return acc;
      },
      { workedMinutes: 0, overtimeMinutes: 0, plannedMinutes: 0 },
    );
    return { from, to, totals, rows };
  }

  async adjustDay(id: string, actorId: string, dto: AdjustAttendanceDayDto) {
    const existing = await this.prisma.attendanceDay.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Jour de presence introuvable');
    return this.prisma.attendanceDay.update({
      where: { id },
      data: {
        workedMinutes: dto.workedMinutes ?? existing.workedMinutes,
        overtimeMinutes: dto.overtimeMinutes ?? existing.overtimeMinutes,
        notes: dto.notes?.trim() ?? existing.notes,
        adjustedById: actorId,
        adjustmentReason: dto.adjustmentReason?.trim() || existing.adjustmentReason,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async recomputeDay(userId: string, date: string, adjustedById?: string) {
    const { day, end } = parseDay(date);
    const [punches, shift, profile, onLeave] = await Promise.all([
      this.prisma.attendancePunch.findMany({
        where: { userId, punchedAt: { gte: day, lt: end }, cancelledAt: null },
        orderBy: { punchedAt: 'asc' },
      }),
      this.prisma.shiftAssignment.findFirst({ where: { userId, date: day } }),
      this.prisma.employeeProfile.findUnique({ where: { userId } }),
      this.prisma.leaveRequest.findFirst({
        where: {
          userId,
          status: LeaveStatus.VALIDEE,
          startDate: { lte: day },
          endDate: { gte: day },
        },
      }),
    ]);

    const dailyMinutes = profile?.dailyMinutes ?? 480;
    const grace = profile?.graceLateMinutes ?? 15;
    const plannedMinutes = shift
      ? Math.max(0, timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime))
      : dailyMinutes;

    if (onLeave) {
      return this.prisma.attendanceDay.upsert({
        where: { userId_date: { userId, date: day } },
        create: {
          userId,
          date: day,
          status: PresenceStatus.CONGE,
          shiftId: shift?.id,
          plannedMinutes: 0,
          workedMinutes: 0,
          adjustedById,
        },
        update: {
          status: PresenceStatus.CONGE,
          plannedMinutes: 0,
          workedMinutes: 0,
          overtimeMinutes: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          firstInAt: null,
          lastOutAt: null,
          shiftId: shift?.id,
          adjustedById,
        },
        include: { user: { select: USER_SELECT } },
      });
    }

    let workedMinutes = 0;
    let breakMinutes = 0;
    let firstInAt: Date | null = null;
    let lastOutAt: Date | null = null;
    let sessionStart: Date | null = null;
    let pauseStart: Date | null = null;

    for (const punch of punches) {
      if (punch.type === AttendancePunchType.ENTREE) {
        sessionStart = punch.punchedAt;
        if (!firstInAt) firstInAt = punch.punchedAt;
      } else if (punch.type === AttendancePunchType.PAUSE_DEBUT && sessionStart) {
        pauseStart = punch.punchedAt;
        workedMinutes += minutesBetween(sessionStart, punch.punchedAt);
        sessionStart = null;
      } else if (punch.type === AttendancePunchType.PAUSE_FIN) {
        sessionStart = punch.punchedAt;
        if (pauseStart) {
          breakMinutes += minutesBetween(pauseStart, punch.punchedAt);
          pauseStart = null;
        }
      } else if (punch.type === AttendancePunchType.SORTIE && sessionStart) {
        workedMinutes += minutesBetween(sessionStart, punch.punchedAt);
        lastOutAt = punch.punchedAt;
        sessionStart = null;
      }
    }

    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    if (shift && firstInAt) {
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const plannedStart = new Date(day);
      plannedStart.setUTCHours(sh || 0, sm || 0, 0, 0);
      const diff = minutesBetween(plannedStart, firstInAt);
      if (diff > grace) lateMinutes = diff - grace;
    }
    if (shift && lastOutAt) {
      const [eh, em] = shift.endTime.split(':').map(Number);
      const plannedEnd = new Date(day);
      plannedEnd.setUTCHours(eh || 0, em || 0, 0, 0);
      if (lastOutAt < plannedEnd) {
        earlyLeaveMinutes = minutesBetween(lastOutAt, plannedEnd);
      }
    }

    const overtimeMinutes = Math.max(0, workedMinutes - plannedMinutes);
    let status = PresenceStatus.INCOMPLET;
    if (!punches.length) {
      status = PresenceStatus.ABSENT;
    } else if (lastOutAt) {
      status = lateMinutes > 0 ? PresenceStatus.RETARD : PresenceStatus.PRESENT;
    } else if (firstInAt) {
      status = lateMinutes > 0 ? PresenceStatus.RETARD : PresenceStatus.INCOMPLET;
    }

    return this.prisma.attendanceDay.upsert({
      where: { userId_date: { userId, date: day } },
      create: {
        userId,
        date: day,
        status,
        shiftId: shift?.id,
        plannedMinutes,
        workedMinutes,
        breakMinutes,
        overtimeMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        firstInAt,
        lastOutAt,
        adjustedById,
      },
      update: {
        status,
        shiftId: shift?.id,
        plannedMinutes,
        workedMinutes,
        breakMinutes,
        overtimeMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        firstInAt,
        lastOutAt,
        adjustedById,
      },
      include: { user: { select: USER_SELECT } },
    });
  }
}
