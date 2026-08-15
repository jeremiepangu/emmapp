import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';
import { LoginDto } from './dto/login.dto';
import { MfaService } from '../security/mfa.service';
import { SecurityService } from '../security/security.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private security: SecurityService,
    private mfa: MfaService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      await this.security.recordFailedLogin({
        email: dto.email,
        ipAddress,
        reason: 'Identifiants invalides',
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.security.recordFailedLogin({
        email: dto.email,
        ipAddress,
        reason: 'Identifiants invalides',
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    const mfaRequired = await this.mfa.isMfaRequired(user.id, user.role);
    if (mfaRequired) {
      if (!dto.mfaCode) {
        return { mfaRequired: true as const, accessToken: '', user: null };
      }
      const ok = await this.mfa.verifyUserCode(user.id, dto.mfaCode);
      if (!ok) {
        await this.security.recordFailedLogin({
          email: dto.email,
          ipAddress,
          reason: 'Code MFA invalide',
        });
        throw new UnauthorizedException('Code MFA invalide');
      }
    }

    await this.security.recordSuccessfulLogin({
      userId: user.id,
      email: user.email,
      ipAddress,
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }
}
