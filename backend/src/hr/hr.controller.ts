import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractType, EmployeeStatus, LeaveType, UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { HrService } from './hr.service';
import { SirhService } from './sirh.service';

const HR_READ = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.DG,
  UserRole.SUPERVISEUR,
  UserRole.COMPTABLE,
  UserRole.CHEF_EXPLOITATION,
  UserRole.CHEF_PRODUCTION,
] as const;
const HR_WRITE = [UserRole.ADMIN, UserRole.RH] as const;
const PAYROLL_WRITE = [UserRole.ADMIN, UserRole.RH, UserRole.COMPTABLE] as const;
const ACTIVITY_MANAGERS = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.DG,
  UserRole.SUPERVISEUR,
  UserRole.CHEF_EXPLOITATION,
  UserRole.CHEF_PRODUCTION,
  UserRole.COMPTABLE,
] as const;

class UpsertActivityReportDto {
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  incidents?: string;
}

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrController {
  constructor(private hr: HrService, private sirh: SirhService) {}

  @Roles(...HR_READ)
  @Get('employees')
  employees() {
    return this.hr.listEmployees();
  }

  @Roles(...HR_WRITE)
  @Post('employees')
  createEmployee(
    @Body()
    body: {
      userId: string;
      matricule?: string;
      jobTitle: string;
      department: string;
      contractType?: ContractType;
      hireDate: string;
      endDate?: string;
      baseSalary: number;
      bankName?: string;
      bankAccount?: string;
      cnssNumber?: string;
      nif?: string;
      notes?: string;
      gender?: string;
      birthDate?: string;
      address?: string;
      avenue?: string;
      avenueNumber?: string;
      quartier?: string;
      commune?: string;
      district?: string;
      maritalStatus?: string;
      emergencyName?: string;
      emergencyPhone?: string;
      photoUrl?: string;
      managerId?: string;
      jobFunctionId?: string;
      annualLeaveDays?: number;
    },
  ) {
    return this.hr.createEmployee(body as never);
  }

  @Roles(...HR_WRITE)
  @Patch('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      jobTitle: string;
      department: string;
      contractType: ContractType;
      hireDate: string;
      endDate: string | null;
      baseSalary: number;
      bankName: string;
      bankAccount: string;
      cnssNumber: string;
      nif: string;
      status: EmployeeStatus;
      notes: string;
      gender: string;
      birthDate: string | null;
      address: string;
      avenue: string;
      avenueNumber: string;
      quartier: string;
      commune: string;
      district: string;
      maritalStatus: string;
      emergencyName: string;
      emergencyPhone: string;
      photoUrl: string;
      managerId: string | null;
      jobFunctionId: string | null;
      annualLeaveDays: number;
    }>,
    @Req() req: { user: { id: string } },
  ) {
    return this.hr.updateEmployee(id, body as never, req.user.id);
  }

  @Roles(...HR_WRITE)
  @Delete('employees/:id')
  deleteEmployee(@Param('id') id: string) {
    return this.hr.deleteEmployee(id);
  }

  @Get('leaves/me')
  myLeaves(@Req() req: { user: { id: string } }) {
    return this.hr.listLeaves().then((rows) => rows.filter((r) => r.userId === req.user.id));
  }

  @Roles(...HR_READ)
  @Get('leaves')
  leaves() {
    return this.hr.listLeaves();
  }

  @Post('leaves')
  createLeave(
    @Req() req: { user: { id: string; role: UserRole } },
    @Body()
    body: { userId?: string; type: LeaveType; startDate: string; endDate: string; reason?: string },
  ) {
    const isHr = ([UserRole.ADMIN, UserRole.RH, UserRole.DG] as UserRole[]).includes(req.user.role);
    const userId = isHr && body.userId ? body.userId : req.user.id;
    return this.hr.createLeave({ ...body, userId });
  }

  @Roles(...HR_WRITE)
  @Patch('leaves/:id')
  updateLeave(
    @Param('id') id: string,
    @Body() body: Partial<{ type: LeaveType; startDate: string; endDate: string; reason: string }>,
  ) {
    return this.hr.updateLeave(id, body);
  }

  @Patch('leaves/:id/validate')
  validateLeave(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.hr.decideLeave(id, true, req.user.id);
  }

  @Patch('leaves/:id/reject')
  rejectLeave(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
    @Body() body: { reason?: string },
  ) {
    return this.hr.decideLeave(id, false, req.user.id, body.reason);
  }

  @Roles(...HR_WRITE)
  @Delete('leaves/:id')
  cancelLeave(@Param('id') id: string) {
    return this.hr.cancelLeave(id);
  }

  @Roles(...HR_READ)
  @Get('payroll/periods')
  periods() {
    return this.hr.listPeriods();
  }

  @Roles(...PAYROLL_WRITE)
  @Post('payroll/periods')
  createPeriod(@Body() body: { year: number; month: number; expectedDays?: number; notes?: string }) {
    return this.hr.createPeriod(body);
  }

  @Roles(...PAYROLL_WRITE)
  @Post('payroll/periods/:id/compute')
  compute(@Param('id') id: string) {
    return this.hr.computePeriod(id);
  }

  @Roles(...PAYROLL_WRITE)
  @Patch('payroll/periods/:id/validate')
  validatePeriod(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.hr.validatePeriod(id, req.user.id);
  }

  @Roles(...PAYROLL_WRITE)
  @Patch('payroll/periods/:id/close')
  closePeriod(@Param('id') id: string) {
    return this.hr.closePeriod(id);
  }

  @Roles(...HR_WRITE)
  @Delete('payroll/periods/:id')
  deletePeriod(@Param('id') id: string) {
    return this.hr.deletePeriod(id);
  }

  @Roles(...HR_READ)
  @Get('payroll/periods/:id/payslips')
  payslips(@Param('id') id: string) {
    return this.hr.listPayslips(id);
  }

  @Roles(...PAYROLL_WRITE)
  @Patch('payroll/payslips/:id')
  updatePayslip(
    @Param('id') id: string,
    @Body() body: Partial<{ overtimeHours: number; bonuses: number; deductions: number }>,
  ) {
    return this.hr.updatePayslip(id, body);
  }

  @Roles(...PAYROLL_WRITE)
  @Patch('payroll/payslips/:id/validate')
  validatePayslip(@Param('id') id: string) {
    return this.hr.validatePayslip(id);
  }

  @Roles(...PAYROLL_WRITE)
  @Patch('payroll/payslips/:id/pay')
  payPayslip(@Param('id') id: string, @Body() body: { paymentReference?: string }) {
    return this.hr.payPayslip(id, body.paymentReference);
  }

  @Roles(...HR_READ)
  @Get('dashboard')
  dashboard(@Query('department') department?: string, @Query('year') year?: string) {
    return this.sirh.dashboard({ department, year: year ? Number(year) : undefined });
  }

  @Get('leave-balance')
  leaveBalance(@Req() req: { user: { id: string } }, @Query('userId') userId?: string, @Query('year') year?: string) {
    return this.sirh.leaveBalance(userId || req.user.id, year ? Number(year) : undefined);
  }

  @Roles(...HR_READ)
  @Get('leave-calendar')
  leaveCalendar(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('department') department?: string,
  ) {
    const from = start || new Date().toISOString().slice(0, 8) + '01';
    const to = end || new Date().toISOString().slice(0, 10);
    return this.sirh.leaveCalendar(from, to, department);
  }

  @Roles(...HR_READ)
  @Get('functions')
  functions() {
    return this.sirh.listFunctions();
  }

  @Roles(...HR_WRITE)
  @Post('functions')
  createFunction(@Body() body: { name: string; department?: string; activities?: string[] }) {
    return this.sirh.createFunction(body);
  }

  @Roles(...HR_WRITE)
  @Post('functions/:id/activities')
  addActivity(@Param('id') id: string, @Body() body: { name: string }) {
    return this.sirh.addFunctionActivity(id, body.name);
  }

  @Get('functions/my-activities')
  myJobActivities(@Req() req: { user: { id: string } }) {
    return this.sirh.myActivities(req.user.id);
  }

  @Roles(...HR_READ)
  @Get('declarations')
  declarations(@Query('userId') userId?: string, @Query('date') date?: string) {
    return this.sirh.listDeclarations({ userId, date });
  }

  @Post('declarations')
  declare(
    @Req() req: { user: { id: string } },
    @Body() body: { activityId?: string; date: string; comment?: string; attachmentUrl?: string },
  ) {
    return this.sirh.declareActivity(req.user.id, body);
  }

  @Patch('declarations/:id/validate')
  validateDeclaration(@Param('id') id: string, @Req() req: { user: { id: string; role: UserRole } }) {
    return this.sirh.decideDeclaration(id, req.user, true);
  }

  @Patch('declarations/:id/reject')
  rejectDeclaration(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: UserRole } },
    @Body() body: { reason?: string },
  ) {
    return this.sirh.decideDeclaration(id, req.user, false, body.reason);
  }

  @Roles(...HR_READ)
  @Get('objectives')
  objectives(@Query('userId') userId?: string, @Query('year') year?: string) {
    return this.sirh.listObjectives(userId, year ? Number(year) : undefined);
  }

  @Roles(...HR_WRITE)
  @Post('objectives')
  createObjective(
    @Body()
    body: { userId: string; title: string; description?: string; periodType?: string; year: number; quarter?: number; weight: number },
  ) {
    return this.sirh.createObjective(body);
  }

  @Roles(...HR_READ)
  @Get('reviews')
  reviews(@Query('year') year?: string) {
    return this.sirh.listReviews(year ? Number(year) : undefined);
  }

  @Roles(...HR_READ)
  @Get('reviews/ranking')
  ranking(@Query('year') year?: string, @Query('department') department?: string) {
    return this.sirh.ranking(year ? Number(year) : new Date().getFullYear(), department);
  }

  @Post('reviews/self')
  selfReview(
    @Req() req: { user: { id: string } },
    @Body() body: { year: number; period: string; selfScores: Record<string, number>; selfComment?: string },
  ) {
    return this.sirh.upsertSelfReview(req.user.id, body);
  }

  @Patch('reviews/:id/validate')
  validateReview(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: UserRole } },
    @Body() body: { managerScores: Record<string, number>; managerComment?: string },
  ) {
    return this.sirh.validateReview(id, req.user, body);
  }

  @Roles(...HR_READ)
  @Get('trainings')
  trainings() {
    return this.sirh.listCourses();
  }

  @Roles(...HR_WRITE)
  @Post('trainings')
  createTraining(
    @Body()
    body: { title: string; kind?: 'INTERNE' | 'EXTERNE'; provider?: string; location?: string; startDate?: string; endDate?: string },
  ) {
    return this.sirh.createCourse(body as never);
  }

  @Get('trainings/enrollments')
  enrollments(@Req() req: { user: { id: string; role: UserRole } }, @Query('userId') userId?: string) {
    const isHr = ([UserRole.ADMIN, UserRole.RH, UserRole.DG] as UserRole[]).includes(req.user.role);
    return this.sirh.listEnrollments(isHr ? userId : req.user.id);
  }

  @Post('trainings/:id/enroll')
  enroll(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.sirh.enroll(req.user.id, id);
  }

  @Patch('trainings/enrollments/:id/validate')
  validateEnrollment(@Param('id') id: string, @Req() req: { user: { id: string; role: UserRole } }) {
    return this.sirh.decideEnrollment(id, req.user, true);
  }

  @Patch('trainings/enrollments/:id/reject')
  rejectEnrollment(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: UserRole } },
    @Body() body: { reason?: string },
  ) {
    return this.sirh.decideEnrollment(id, req.user, false, body.reason);
  }

  @Roles(...HR_WRITE)
  @Patch('trainings/enrollments/:id/follow')
  followEnrollment(@Param('id') id: string, @Body() body: { certificateUrl?: string }) {
    return this.sirh.markFollowed(id, body.certificateUrl);
  }

  @Roles(...HR_READ)
  @Get('documents')
  documents(
    @Query('employeeId') employeeId?: string,
    @Query('type') type?: string,
    @Query('q') q?: string,
  ) {
    return this.sirh.listDocuments({ employeeId, type: type as never, q });
  }

  @Roles(...HR_WRITE)
  @Post('documents')
  addDocument(
    @Body() body: { employeeId: string; type: string; title: string; fileUrl?: string; issuedAt?: string },
  ) {
    return this.sirh.addDocument(body as never);
  }

  @Roles(...HR_READ)
  @Get('employees/:id/history')
  history(@Param('id') id: string) {
    return this.sirh.history(id);
  }

  @Get('activity-reports/me')
  myActivity(
    @Req() req: { user: { id: string } },
    @Query('date') date?: string,
  ) {
    return this.hr.getActivityReport(req.user.id, date || new Date().toISOString().slice(0, 10));
  }

  @Post('activity-reports/me')
  saveMyActivity(
    @Req() req: { user: { id: string } },
    @Body() body: UpsertActivityReportDto,
  ) {
    return this.hr.upsertActivityReport(req.user.id, body);
  }

  @Roles(...ACTIVITY_MANAGERS)
  @Get('activity-reports/overview')
  activityOverview(@Query('date') date?: string) {
    return this.hr.activityOverview(date || new Date().toISOString().slice(0, 10));
  }

  @Get('activity-reports/:userId')
  agentActivity(
    @Param('userId') userId: string,
    @Query('date') date: string | undefined,
    @Req() req: { user: { id: string; role: UserRole } },
  ) {
    const isManager = (ACTIVITY_MANAGERS as readonly UserRole[]).includes(req.user.role);
    if (userId !== req.user.id && !isManager) {
      throw new ForbiddenException('Accès réservé aux managers');
    }
    return this.hr.getActivityReport(userId, date || new Date().toISOString().slice(0, 10));
  }

  @Roles(...ACTIVITY_MANAGERS)
  @Patch('activity-reports/:id/validate')
  validateActivity(@Param('id') id: string) {
    return this.hr.validateActivityReport(id);
  }
}
