import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class PosLineDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Contenants vides rendus en echange par le client' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  emptiesReturned?: number;
}

export class PosQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  clientId?: string | null;

  @ApiProperty({ type: [PosLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosLineDto)
  lines: PosLineDto[];
}

export class PosCheckoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  clientId?: string | null;

  @ApiProperty({ type: [PosLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosLineDto)
  lines: PosLineDto[];

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Montant encaisse (acompte possible si inferieur au net)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PosAdvanceDto {
  @ApiProperty()
  @IsUUID()
  clientId: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PosAcompteDto {
  @ApiProperty()
  @IsUUID()
  orderId: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}
