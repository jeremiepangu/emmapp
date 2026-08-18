import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientSegment } from '@prisma/client';

function trim(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class RegisterPortalDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Indiquez un e-mail valide' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caracteres' })
  password: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2, { message: 'Indiquez votre nom' })
  fullName: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(8, { message: 'Indiquez un numero de telephone valide' })
  phone: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(2, { message: 'Indiquez votre commune de livraison' })
  commune: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trim(value) || undefined)
  @IsString()
  avenue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trim(value) || undefined)
  @IsString()
  quartier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trim(value) || undefined)
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trim(value) || undefined)
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ enum: ClientSegment })
  @IsOptional()
  @IsEnum(ClientSegment)
  segment?: ClientSegment;
}
