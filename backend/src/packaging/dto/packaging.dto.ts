import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackagingKind, PackagingMovementType, PackagingPackFormat } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePackagingMovementDto {
  @ApiProperty()
  @IsUUID()
  skuId: string;

  @ApiProperty({ enum: PackagingMovementType })
  @IsEnum(PackagingMovementType)
  type: PackagingMovementType;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePackagingSkuDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: PackagingKind })
  @IsEnum(PackagingKind)
  kind: PackagingKind;

  @ApiProperty({ enum: PackagingPackFormat })
  @IsEnum(PackagingPackFormat)
  format: PackagingPackFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;
}

export class UpdatePackagingSkuDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: PackagingKind })
  @IsOptional()
  @IsEnum(PackagingKind)
  kind?: PackagingKind;

  @ApiPropertyOptional({ enum: PackagingPackFormat })
  @IsOptional()
  @IsEnum(PackagingPackFormat)
  format?: PackagingPackFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePackagingMovementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  skuId?: string;

  @ApiPropertyOptional({ enum: PackagingMovementType })
  @IsOptional()
  @IsEnum(PackagingMovementType)
  type?: PackagingMovementType;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PackagingQueryDto {
  @ApiPropertyOptional({ enum: PackagingKind })
  @IsOptional()
  @IsEnum(PackagingKind)
  kind?: PackagingKind;

  @ApiPropertyOptional({ enum: PackagingPackFormat })
  @IsOptional()
  @IsEnum(PackagingPackFormat)
  format?: PackagingPackFormat;

  @ApiPropertyOptional({ enum: PackagingMovementType })
  @IsOptional()
  @IsEnum(PackagingMovementType)
  type?: PackagingMovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  skuId?: string;
}
