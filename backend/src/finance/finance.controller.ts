import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateFinanceAccountDto,
  CreateFinanceBudgetDto,
  CreateFinanceCategoryDto,
  CreateFinanceInventoryDto,
  CreateFinanceMovementDto,
  UpdateFinanceAccountDto,
  UpdateFinanceBudgetDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

const READ = [
  UserRole.ADMIN,
  UserRole.DG,
  UserRole.COMPTABLE,
  UserRole.CAISSIER,
  UserRole.COMMERCIAL,
  UserRole.MAGASINIER,
  UserRole.CHEF_EXPLOITATION,
  UserRole.DATA_ANALYST,
] as const;

const WRITE = [UserRole.ADMIN, UserRole.COMPTABLE, UserRole.CAISSIER, UserRole.MAGASINIER] as const;
const VALIDATE = [UserRole.ADMIN, UserRole.COMPTABLE, UserRole.DG] as const;
const DELETE = [UserRole.ADMIN, UserRole.COMPTABLE] as const;

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Roles(...READ)
  @Get('summary')
  summary() {
    return this.finance.summary();
  }

  @Roles(...READ)
  @Get('accounts')
  accounts() {
    return this.finance.listAccounts();
  }

  @Roles(...WRITE)
  @Post('accounts')
  createAccount(@Body() dto: CreateFinanceAccountDto, @Req() req: { user: { id: string } }) {
    return this.finance.createAccount(dto, req.user.id);
  }

  @Roles(...WRITE)
  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateFinanceAccountDto) {
    return this.finance.updateAccount(id, dto);
  }

  @Roles(...READ)
  @Get('categories')
  categories() {
    return this.finance.listCategories();
  }

  @Roles(...WRITE)
  @Post('categories')
  createCategory(@Body() dto: CreateFinanceCategoryDto) {
    return this.finance.createCategory(dto);
  }

  @Roles(...READ)
  @Get('movements')
  movements(
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.finance.listMovements({ kind, status, accountId, from, to });
  }

  @Roles(...WRITE)
  @Post('movements')
  createMovement(@Body() dto: CreateFinanceMovementDto, @Req() req: { user: { id: string } }) {
    return this.finance.createMovement(dto, req.user.id);
  }

  @Roles(...VALIDATE)
  @Post('movements/:id/validate')
  validateMovement(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.finance.validateMovement(id, req.user.id);
  }

  @Roles(...VALIDATE)
  @Post('movements/:id/cancel')
  cancelMovement(@Param('id') id: string) {
    return this.finance.cancelMovement(id);
  }

  @Roles(...READ)
  @Get('budgets')
  budgets(@Query('year') year?: string, @Query('month') month?: string) {
    return this.finance.listBudgets({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
  }

  @Roles(...WRITE)
  @Post('budgets')
  createBudget(@Body() dto: CreateFinanceBudgetDto) {
    return this.finance.createBudget(dto);
  }

  @Roles(...WRITE)
  @Patch('budgets/:id')
  updateBudget(@Param('id') id: string, @Body() dto: UpdateFinanceBudgetDto) {
    return this.finance.updateBudget(id, dto);
  }

  @Roles(...DELETE)
  @Delete('budgets/:id')
  removeBudget(@Param('id') id: string) {
    return this.finance.removeBudget(id);
  }

  @Roles(...READ)
  @Get('inventory')
  inventories() {
    return this.finance.listInventories();
  }

  @Roles(...READ)
  @Get('inventory/snapshot')
  snapshot() {
    return this.finance.inventorySnapshot();
  }

  @Roles(...WRITE)
  @Post('inventory')
  createInventory(@Body() dto: CreateFinanceInventoryDto, @Req() req: { user: { id: string } }) {
    return this.finance.createInventory(dto, req.user.id);
  }

  @Roles(...VALIDATE)
  @Post('inventory/:id/validate')
  validateInventory(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.finance.validateInventory(id, req.user.id);
  }
}
