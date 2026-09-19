import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Gender,
  HrDocumentType,
  LeaveStatus,
  LeaveType,
  MaritalStatus,
  NotificationCategory,
  NotificationType,
  Prisma,
  ReviewStatus,
  TrainingEnrollmentStatus,
  TrainingKind,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import {
  activityLimitFor,
  canDeclareActivity,
  canSuperviseActivities,
  isActivityAdmin,
  matchesActivityScope,
  profileInActivityTeam,
} from '../authorizations/acl.catalog';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
} as const;

const HR_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.RH, UserRole.DG];
const RH_REQUIRED: LeaveType[] = [
  LeaveType.MALADIE,
  LeaveType.MATERNITE,
  LeaveType.PATERNITE,
  LeaveType.SANS_SOLDE,
  LeaveType.ABSENCE_INJUSTIFIEE,
];

function yearRange(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return { start, end };
}

@Injectable()
export class SirhService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  isHr(role: UserRole) {
    return HR_ROLES.includes(role);
  }

  async teamUserIds(actorId: string) {
    const reports = await this.prisma.employeeProfile.findMany({
      where: { managerId: actorId, status: 'ACTIF' },
      select: { userId: true },
    });
    return reports.map((r) => r.userId);
  }

  async assertManagerOrHr(actor: { id: string; role: UserRole }, targetUserId: string) {
    if (this.isHr(actor.role) || actor.id === targetUserId) return;
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId: targetUserId } });
    if (profile?.managerId === actor.id) return;
    throw new ForbiddenException('Action reservee au responsable ou au RH');
  }

  async assertActivitySupervisor(actor: { id: string; role: UserRole }, targetUserId: string) {
    if (actor.id === targetUserId) {
      throw new ForbiddenException('Vous ne pouvez pas valider votre propre déclaration');
    }
    if (isActivityAdmin(actor.role)) return;
    if (!canSuperviseActivities(actor.role)) {
      throw new ForbiddenException('Validation réservée au responsable d’activité');
    }
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId: targetUserId },
      include: { jobFunction: true },
    });
    if (
      profileInActivityTeam(actor.role, actor.id, {
        userId: targetUserId,
        department: profile?.department,
        managerId: profile?.managerId,
        jobFunctionName: profile?.jobFunction?.name,
      })
    ) {
      return;
    }
    throw new ForbiddenException('Cette déclaration est hors du périmètre d’activités de votre profil');
  }

  private async scopedUserIds(actor: { id: string; role: UserRole }): Promise<string[] | null> {
    if (isActivityAdmin(actor.role)) return null;
    const limit = activityLimitFor(actor.role);
    if (!limit.team) return [actor.id];
    if (limit.departments === '*') return null;
    const employees = await this.prisma.employeeProfile.findMany({
      where: { status: 'ACTIF' },
      include: { jobFunction: true },
    });
    const ids = employees
      .filter((row) =>
        profileInActivityTeam(actor.role, actor.id, {
          userId: row.userId,
          department: row.department,
          managerId: row.managerId,
          jobFunctionName: row.jobFunction?.name,
        }),
      )
      .map((row) => row.userId);
    if (!ids.includes(actor.id)) ids.push(actor.id);
    return ids;
  }

  async dashboard(params: { department?: string; year?: number }) {
    const year = params.year ?? new Date().getFullYear();
    const { start, end } = yearRange(year);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dept = params.department?.trim() || undefined;
    const empWhere: Prisma.EmployeeProfileWhereInput = dept ? { department: dept } : {};

    const employees = await this.prisma.employeeProfile.findMany({
      where: empWhere,
      include: { user: { select: USER_SELECT } },
    });
    const userIds = employees.map((e) => e.userId);
    const active = employees.filter((e) => e.status === 'ACTIF');
    const byDepartment: Record<string, number> = {};
    const byGender: Record<string, number> = { HOMME: 0, FEMME: 0, AUTRE: 0, NON_RENSEIGNE: 0 };
    for (const e of active) {
      byDepartment[e.department] = (byDepartment[e.department] ?? 0) + 1;
      byGender[e.gender ?? 'NON_RENSEIGNE'] = (byGender[e.gender ?? 'NON_RENSEIGNE'] ?? 0) + 1;
    }

    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds.length ? userIds : ['__none__'] },
        status: LeaveStatus.VALIDEE,
        startDate: { lt: end },
        endDate: { gte: start },
      },
    });
    const consumed = leaves.filter((l) => l.type === LeaveType.CONGE_PAYE).reduce((s, l) => s + l.days, 0);
    const rights = active.reduce((s, e) => s + e.annualLeaveDays, 0);
    const absentToday = leaves.filter((l) => l.startDate <= today && l.endDate >= today).length;

    const declarations = await this.prisma.activityDeclaration.findMany({
      where: { userId: { in: userIds.length ? userIds : ['__none__'] }, date: { gte: start, lt: end } },
    });
    const validatedActs = declarations.filter((d) => d.status === LeaveStatus.VALIDEE).length;
    const rejectedActs = declarations.filter((d) => d.status === LeaveStatus.REJETEE).length;

    const reviews = await this.prisma.performanceReview.findMany({
      where: { userId: { in: userIds.length ? userIds : ['__none__'] }, year, status: ReviewStatus.VALIDEE },
    });
    const avgScore = reviews.length
      ? reviews.reduce((s, r) => s + Number(r.finalScore ?? 0), 0) / reviews.length
      : 0;
    const objectives = await this.prisma.performanceObjective.count({
      where: { userId: { in: userIds.length ? userIds : ['__none__'] }, year },
    });

    const enrollments = await this.prisma.trainingEnrollment.findMany({
      where: { userId: { in: userIds.length ? userIds : ['__none__'] } },
    });

    const in30 = new Date(today);
    in30.setUTCDate(in30.getUTCDate() + 30);
    const contractsEnding = active.filter((e) => e.endDate && e.endDate >= today && e.endDate <= in30);
    const birthdays = active.filter((e) => {
      if (!e.birthDate) return false;
      return e.birthDate.getUTCMonth() === today.getUTCMonth();
    });

    return {
      year,
      department: dept ?? null,
      effectifs: {
        total: active.length,
        archived: employees.filter((e) => e.status !== 'ACTIF').length,
        byDepartment,
        byGender,
      },
      conges: {
        consumed,
        remaining: Math.max(0, rights - consumed),
        rights,
        absentToday,
      },
      activites: {
        declared: declarations.length,
        validated: validatedActs,
        rejected: rejectedActs,
        rate: declarations.length ? Math.round((validatedActs / declarations.length) * 100) : 0,
      },
      performance: {
        average: Number(avgScore.toFixed(1)),
        reviews: reviews.length,
        objectives,
      },
      formations: {
        inscribed: enrollments.length,
        followed: enrollments.filter((e) => e.status === TrainingEnrollmentStatus.SUIVIE).length,
      },
      alerts: {
        contractsEnding: contractsEnding.map((e) => ({
          matricule: e.matricule,
          name: e.user ? `${e.user.firstName} ${e.user.lastName}` : e.matricule,
          endDate: e.endDate,
        })),
        birthdays: birthdays.map((e) => ({
          matricule: e.matricule,
          name: e.user ? `${e.user.firstName} ${e.user.lastName}` : e.matricule,
          birthDate: e.birthDate,
        })),
      },
    };
  }

  listFunctions(actor?: { id: string; role: UserRole }) {
    const where: Prisma.JobFunctionWhereInput = { isActive: true };
    if (actor && !isActivityAdmin(actor.role)) {
      const limit = activityLimitFor(actor.role);
      if (limit.functions !== '*') {
        if (!limit.functions.length) {
          where.id = '__none__';
        } else {
          where.name = { in: limit.functions };
        }
      }
    }
    return this.prisma.jobFunction.findMany({
      where,
      include: { activities: { orderBy: { name: 'asc' } }, _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createFunction(body: { name: string; department?: string; activities?: string[] }) {
    const name = body.name.trim();
    if (!name) throw new BadRequestException('Nom de fonction obligatoire');
    return this.prisma.jobFunction.create({
      data: {
        name,
        department: body.department,
        activities: {
          create: (body.activities ?? []).filter((a) => a.trim()).map((a) => ({ name: a.trim() })),
        },
      },
      include: { activities: true },
    });
  }

  addFunctionActivity(functionId: string, name: string) {
    return this.prisma.jobFunctionActivity.create({
      data: { functionId, name: name.trim() },
    });
  }

  async myActivities(userId: string, role: UserRole) {
    const limit = activityLimitFor(role);
    if (limit.functions !== '*' && !limit.functions.length) return [];
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: { jobFunction: { include: { activities: { orderBy: { name: 'asc' } } } } },
    });
    if (limit.functions === '*') {
      return profile?.jobFunction?.activities ?? [];
    }
    const functions = await this.prisma.jobFunction.findMany({
      where: { isActive: true, name: { in: limit.functions } },
      include: { activities: { orderBy: { name: 'asc' } } },
    });
    const fromRole = functions.flatMap((fn) =>
      fn.activities.map((activity) => ({ ...activity, jobFunction: { id: fn.id, name: fn.name, department: fn.department } })),
    );
    if (profile?.jobFunction && matchesActivityScope(limit.functions, profile.jobFunction.name)) {
      return profile.jobFunction.activities.map((activity) => ({
        ...activity,
        jobFunction: { id: profile.jobFunction!.id, name: profile.jobFunction!.name, department: profile.jobFunction!.department },
      }));
    }
    return fromRole;
  }

  async listDeclarations(actor: { id: string; role: UserRole }, params: { userId?: string; date?: string }) {
    const where: Prisma.ActivityDeclarationWhereInput = {};
    const scoped = await this.scopedUserIds(actor);
    if (params.userId) {
      if (scoped && !scoped.includes(params.userId)) {
        throw new ForbiddenException('Hors du périmètre d’activités de votre profil');
      }
      where.userId = params.userId;
    } else if (scoped) {
      where.userId = { in: scoped };
    }
    if (params.date) where.date = new Date(`${params.date}T00:00:00.000Z`);
    return this.prisma.activityDeclaration.findMany({
      where,
      include: {
        user: { select: USER_SELECT },
        activity: true,
        validator: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });
  }

  async declareActivity(
    userId: string,
    role: UserRole,
    body: { activityId?: string; date: string; comment?: string; attachmentUrl?: string },
  ) {
    if (!body.date) throw new BadRequestException('Date obligatoire');
    if (!canDeclareActivity(role)) {
      throw new ForbiddenException('Votre profil n’autorise pas la déclaration d’activité');
    }
    if (body.activityId) {
      const activity = await this.prisma.jobFunctionActivity.findUnique({
        where: { id: body.activityId },
        include: { jobFunction: true },
      });
      if (!activity) throw new BadRequestException('Activité introuvable');
      const limit = activityLimitFor(role);
      const allowed =
        limit.functions === '*' || matchesActivityScope(limit.functions, activity.jobFunction?.name);
      if (!allowed) {
        throw new ForbiddenException('Cette activité n’est pas dans le périmètre de votre profil');
      }
    }
    return this.prisma.activityDeclaration.create({
      data: {
        userId,
        activityId: body.activityId || null,
        date: new Date(`${body.date}T00:00:00.000Z`),
        comment: body.comment,
        attachmentUrl: body.attachmentUrl,
        status: LeaveStatus.SOUMISE,
      },
      include: { activity: true, user: { select: USER_SELECT } },
    });
  }

  async decideDeclaration(
    id: string,
    actor: { id: string; role: UserRole },
    approve: boolean,
    reason?: string,
  ) {
    const row = await this.prisma.activityDeclaration.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Declaration introuvable');
    await this.assertActivitySupervisor(actor, row.userId);
    if (!approve && !reason?.trim()) throw new BadRequestException('Motif de rejet obligatoire');
    const updated = await this.prisma.activityDeclaration.update({
      where: { id },
      data: {
        status: approve ? LeaveStatus.VALIDEE : LeaveStatus.REJETEE,
        validatedById: actor.id,
        validatedAt: new Date(),
        rejectionReason: approve ? null : reason,
      },
      include: { activity: true, user: { select: USER_SELECT } },
    });
    await this.notifications.create({
      userId: row.userId,
      title: approve ? 'Activite validee' : 'Activite rejetee',
      message: approve
        ? 'Votre declaration d activite a ete validee.'
        : `Votre declaration a ete rejetee : ${reason}`,
      type: approve ? NotificationType.SUCCESS : NotificationType.WARNING,
      category: NotificationCategory.RH,
      link: '/hr',
    });
    return updated;
  }

  listObjectives(userId?: string, year?: number) {
    return this.prisma.performanceObjective.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(year ? { year } : {}),
      },
      include: { user: { select: USER_SELECT } },
      orderBy: [{ year: 'desc' }, { weight: 'desc' }],
    });
  }

  createObjective(body: {
    userId: string;
    title: string;
    description?: string;
    periodType?: string;
    year: number;
    quarter?: number;
    weight: number;
  }) {
    if (body.weight <= 0) throw new BadRequestException('Pondération invalide');
    return this.prisma.performanceObjective.create({
      data: {
        userId: body.userId,
        title: body.title,
        description: body.description,
        periodType: body.periodType || 'ANNUEL',
        year: body.year,
        quarter: body.quarter,
        weight: body.weight,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  listReviews(year?: number) {
    return this.prisma.performanceReview.findMany({
      where: year ? { year } : {},
      include: {
        user: { select: USER_SELECT },
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ year: 'desc' }, { period: 'asc' }],
    });
  }

  async upsertSelfReview(
    userId: string,
    body: { year: number; period: string; selfScores: Record<string, number>; selfComment?: string },
  ) {
    return this.prisma.performanceReview.upsert({
      where: { userId_year_period: { userId, year: body.year, period: body.period } },
      create: {
        userId,
        year: body.year,
        period: body.period,
        selfScores: body.selfScores as Prisma.InputJsonValue,
        selfComment: body.selfComment,
        selfSubmittedAt: new Date(),
        status: ReviewStatus.AUTO_EVALUEE,
      },
      update: {
        selfScores: body.selfScores as Prisma.InputJsonValue,
        selfComment: body.selfComment,
        selfSubmittedAt: new Date(),
        status: ReviewStatus.AUTO_EVALUEE,
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async validateReview(
    id: string,
    actor: { id: string; role: UserRole },
    body: { managerScores: Record<string, number>; managerComment?: string },
  ) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Evaluation introuvable');
    await this.assertManagerOrHr(actor, review.userId);
    const objectives = await this.prisma.performanceObjective.findMany({
      where: { userId: review.userId, year: review.year },
    });
    let weighted = 0;
    let totalWeight = 0;
    for (const obj of objectives) {
      const note = Number(body.managerScores[obj.id] ?? 0);
      const w = Number(obj.weight);
      weighted += note * w;
      totalWeight += w;
    }
    const finalScore = totalWeight ? Number((weighted / totalWeight).toFixed(2)) : 0;
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        managerScores: body.managerScores as Prisma.InputJsonValue,
        managerComment: body.managerComment,
        managerId: actor.id,
        managerValidatedAt: new Date(),
        finalScore,
        status: ReviewStatus.VALIDEE,
      },
      include: { user: { select: USER_SELECT } },
    });
    await this.notifications.create({
      userId: review.userId,
      title: 'Evaluation completee',
      message: `Votre evaluation ${review.period} a ete validee. Score : ${finalScore}`,
      type: NotificationType.INFO,
      category: NotificationCategory.RH,
      link: '/hr',
    });
    return updated;
  }

  ranking(year: number, department?: string) {
    return this.prisma.performanceReview.findMany({
      where: {
        year,
        status: ReviewStatus.VALIDEE,
        ...(department
          ? { user: { employeeProfile: { department } } }
          : {}),
      },
      include: { user: { select: { ...USER_SELECT, employeeProfile: { select: { department: true, matricule: true } } } } },
      orderBy: { finalScore: 'desc' },
    });
  }

  listCourses() {
    return this.prisma.trainingCourse.findMany({
      where: { isActive: true },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { title: 'asc' },
    });
  }

  createCourse(body: {
    title: string;
    kind?: TrainingKind;
    provider?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.prisma.trainingCourse.create({
      data: {
        title: body.title,
        kind: body.kind ?? TrainingKind.INTERNE,
        provider: body.provider,
        location: body.location,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });
  }

  listEnrollments(userId?: string) {
    return this.prisma.trainingEnrollment.findMany({
      where: userId ? { userId } : {},
      include: {
        course: true,
        user: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  enroll(userId: string, courseId: string) {
    return this.prisma.trainingEnrollment.upsert({
      where: { courseId_userId: { courseId, userId } },
      create: { courseId, userId, status: TrainingEnrollmentStatus.INSCRITE },
      update: { status: TrainingEnrollmentStatus.INSCRITE, rejectionReason: null },
      include: { course: true },
    });
  }

  async decideEnrollment(
    id: string,
    actor: { id: string; role: UserRole },
    approve: boolean,
    reason?: string,
    certificateUrl?: string,
  ) {
    const row = await this.prisma.trainingEnrollment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Inscription introuvable');
    await this.assertManagerOrHr(actor, row.userId);
    if (!approve && !reason?.trim()) throw new BadRequestException('Motif de rejet obligatoire');
    return this.prisma.trainingEnrollment.update({
      where: { id },
      data: {
        status: approve ? TrainingEnrollmentStatus.VALIDEE : TrainingEnrollmentStatus.REJETEE,
        validatedById: actor.id,
        rejectionReason: approve ? null : reason,
        certificateUrl: certificateUrl ?? undefined,
      },
      include: { course: true, user: { select: USER_SELECT } },
    });
  }

  markFollowed(id: string, certificateUrl?: string) {
    return this.prisma.trainingEnrollment.update({
      where: { id },
      data: { status: TrainingEnrollmentStatus.SUIVIE, certificateUrl },
      include: { course: true, user: { select: USER_SELECT } },
    });
  }

  listDocuments(params: { employeeId?: string; type?: HrDocumentType; q?: string }) {
    const where: Prisma.EmployeeDocumentWhereInput = {};
    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.type) where.type = params.type;
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { employee: { matricule: { contains: params.q, mode: 'insensitive' } } },
        { employee: { user: { lastName: { contains: params.q, mode: 'insensitive' } } } },
      ];
    }
    return this.prisma.employeeDocument.findMany({
      where,
      include: { employee: { include: { user: { select: USER_SELECT } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  addDocument(body: {
    employeeId: string;
    type: HrDocumentType;
    title: string;
    fileUrl?: string;
    issuedAt?: string;
  }) {
    return this.prisma.employeeDocument.create({
      data: {
        employeeId: body.employeeId,
        type: body.type,
        title: body.title,
        fileUrl: body.fileUrl,
        issuedAt: body.issuedAt ? new Date(body.issuedAt) : null,
      },
      include: { employee: { include: { user: { select: USER_SELECT } } } },
    });
  }

  history(employeeId: string) {
    return this.prisma.employeeFieldHistory.findMany({
      where: { employeeId },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async leaveBalance(userId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const profile = await this.prisma.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Dossier RH introuvable');
    const { start, end } = yearRange(y);
    const taken = await this.prisma.leaveRequest.aggregate({
      where: {
        userId,
        type: LeaveType.CONGE_PAYE,
        status: LeaveStatus.VALIDEE,
        startDate: { gte: start, lt: end },
      },
      _sum: { days: true },
    });
    const consumed = taken._sum.days ?? 0;
    return {
      year: y,
      rights: profile.annualLeaveDays,
      consumed,
      remaining: Math.max(0, profile.annualLeaveDays - consumed),
    };
  }

  async leaveCalendar(start: string, end: string, department?: string) {
    const from = new Date(`${start}T00:00:00.000Z`);
    const to = new Date(`${end}T00:00:00.000Z`);
    return this.prisma.leaveRequest.findMany({
      where: {
        status: { in: [LeaveStatus.VALIDEE, LeaveStatus.VALIDEE_MANAGER, LeaveStatus.SOUMISE] },
        startDate: { lte: to },
        endDate: { gte: from },
        ...(department ? { user: { employeeProfile: { department } } } : {}),
      },
      include: { user: { select: { ...USER_SELECT, employeeProfile: { select: { department: true, matricule: true } } } } },
      orderBy: { startDate: 'asc' },
    });
  }

  rhRequired(type: LeaveType) {
    return RH_REQUIRED.includes(type);
  }

  async notifyLeaveDecision(userId: string, approve: boolean, reason?: string) {
    await this.notifications.create({
      userId,
      title: approve ? 'Conge valide' : 'Conge rejete',
      message: approve
        ? 'Votre demande de conge a ete validee.'
        : `Votre demande de conge a ete rejetee${reason ? ` : ${reason}` : '.'}`,
      type: approve ? NotificationType.SUCCESS : NotificationType.WARNING,
      category: NotificationCategory.RH,
      link: '/hr',
    });
  }
}

export const SIRH_USER_SELECT = USER_SELECT;
export const SIRH_HR_ROLES = HR_ROLES;
export type { Gender, MaritalStatus };
