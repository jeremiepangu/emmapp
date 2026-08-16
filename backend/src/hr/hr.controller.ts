import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractType, EmployeeStatus, LeaveType, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { HrService } from './hr.service';

const HR_READ = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.DG,
  UserRole.SUPERVISEUR,
  UserRole.COMPTABLE,
] as const;
const HR_WRITE = [UserRole.ADMIN, UserRole.RH] as const;
const PAYROLL_WRITE = [UserRole.ADMIN, UserRole.RH, UserRole.COMPTABLE] as const;

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrController {
  constructor(private hr: HrService) {}

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
    },
  ) {
    return this.hr.createEmployee(body);
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
    }>,
  ) {
    return this.hr.updateEmployee(id, body);
  }

  @Roles(...HR_WRITE)
  @Delete('employees/:id')
  deleteEmployee(@Param('id') id: string) {
    return this.hr.deleteEmployee(id);
  }

  @Roles(...HR_READ)
  @Get('leaves')
  leaves() {
    return this.hr.listLeaves();
  }

  @Roles(...HR_WRITE)
  @Post('leaves')
  createLeave(
    @Body()
    body: { userId: string; type: LeaveType; startDate: string; endDate: string; reason?: string },
  ) {
    return this.hr.createLeave(body);
  }

  @Roles(...HR_WRITE)
  @Patch('leaves/:id')
  updateLeave(
    @Param('id') id: string,
    @Body() body: Partial<{ type: LeaveType; startDate: string; endDate: string; reason: string }>,
  ) {
    return this.hr.updateLeave(id, body);
  }

  @Roles(...HR_WRITE)
  @Patch('leaves/:id/validate')
  validateLeave(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.hr.decideLeave(id, true, req.user.id);
  }

  @Roles(...HR_WRITE)
  @Patch('leaves/:id/reject')
  rejectLeave(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.hr.decideLeave(id, false, req.user.id);
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
}
