import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPERVISEUR)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('by-role')
  findByRole(@Query('role') role: string) {
    return this.usersService.findByRole(role);
  }
}
