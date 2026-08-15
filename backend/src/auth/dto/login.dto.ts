import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'livreur@emmapp.cd' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, description: 'Code TOTP à 6 chiffres lorsque le MFA est activé' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}
