import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Roles(UserRole.ADMIN, UserRole.DG, UserRole.RH, UserRole.SUPERVISEUR, UserRole.IT_GED)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(
    UserRole.ADMIN,
    UserRole.RH,
    UserRole.MAGASINIER,
    UserRole.CHEF_EXPLOITATION,
    UserRole.SUPERVISEUR,
    UserRole.COMMERCIAL,
    UserRole.DELEGUE_COMMERCIAL,
    UserRole.DG,
  )
  @Get('by-role')
  findByRole(@Query('role') role: string) {
    return this.usersService.findByRole(role);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Post()
  create(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      role: UserRole;
    },
  ) {
    return this.usersService.create(body);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      role: UserRole;
      isActive: boolean;
      password: string;
    }>,
  ) {
    return this.usersService.update(id, body);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
