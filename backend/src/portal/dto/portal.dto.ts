import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class LoginPortalDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Indiquez un e-mail valide' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Indiquez votre mot de passe' })
  password: string;
}

export class CreatePortalOrderLineDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreatePortalOrderDto {
  @ApiProperty({ type: [CreatePortalOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Ajoutez au moins un produit' })
  @ValidateNested({ each: true })
  @Type(() => CreatePortalOrderLineDto)
  lines: CreatePortalOrderLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayPortalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}

export class RedeemLoyaltyDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  points: number;
}
