import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '../common/decorators/roles.decorator';
import { AuthorizationsService } from '../authorizations/authorizations.service';
import { UserRole } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authorizations: AuthorizationsService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Request() req: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0] ?? req.ip;
    return this.authService.login(dto, ip);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: { user: { id: string; role: UserRole; email: string; firstName: string; lastName: string } }) {
    const acl = await this.authorizations.mine(req.user.id, req.user.role);
    return { ...req.user, permissions: acl.matrix };
  }
}
