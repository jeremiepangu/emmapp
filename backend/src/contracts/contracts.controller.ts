import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ContractsService } from './contracts.service';
import {
  CreateAmendmentDto,
  CreateContractDto,
  CreateSupplierDto,
  ContractQueryDto,
  RenewContractDto,
  TerminateContractDto,
  UpdateContractDto,
  UpdateSupplierDto,
} from './dto/contract.dto';

const WRITE = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.COMMERCIAL,
  UserRole.COMPTABLE,
  UserRole.MAGASINIER,
] as const;

const VALIDATE = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.DG,
  UserRole.COMMERCIAL,
  UserRole.COMPTABLE,
] as const;

@ApiTags('contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private contracts: ContractsService) {}

  @Get()
  list(@Query() query: ContractQueryDto) {
    return this.contracts.findAll(query);
  }

  @Get('summary')
  summary() {
    return this.contracts.summary();
  }

  @Get('parties')
  parties() {
    return this.contracts.parties();
  }

  @Get('suppliers')
  suppliers() {
    return this.contracts.listSuppliers();
  }

  @Roles(...WRITE)
  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.contracts.createSupplier(dto);
  }

  @Roles(...WRITE)
  @Patch('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.contracts.updateSupplier(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.RH, UserRole.MAGASINIER)
  @Delete('suppliers/:id')
  deactivateSupplier(@Param('id') id: string) {
    return this.contracts.deactivateSupplier(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contracts.findOne(id);
  }

  @Roles(...WRITE)
  @Post()
  create(@Body() dto: CreateContractDto) {
    return this.contracts.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contracts.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contracts.remove(id);
  }

  @Roles(...VALIDATE)
  @Post(':id/validate')
  validate(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.contracts.validate(id, req.user.id);
  }

  @Roles(...VALIDATE)
  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.contracts.suspend(id);
  }

  @Roles(...VALIDATE)
  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.contracts.resume(id);
  }

  @Roles(...VALIDATE)
  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewContractDto) {
    return this.contracts.renew(id, dto);
  }

  @Roles(...VALIDATE)
  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() dto: TerminateContractDto) {
    return this.contracts.terminate(id, dto);
  }

  @Roles(...WRITE)
  @Post(':id/amendments')
  amend(@Param('id') id: string, @Body() dto: CreateAmendmentDto) {
    return this.contracts.addAmendment(id, dto);
  }
}
