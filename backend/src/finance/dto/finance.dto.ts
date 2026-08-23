import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export const ACCOUNT_KINDS = ['CAISSE', 'BANQUE'] as const;
export const CATEGORY_KINDS = ['RECETTE', 'CHARGE', 'TRANSFERT'] as const;
export const MOVEMENT_KINDS = ['ENTREE', 'SORTIE', 'TRANSFERT', 'DEPENSE', 'ENCAISSEMENT'] as const;
export const PAYMENT_METHODS = [
  'ESPECES',
  'CHEQUE',
  'VIREMENT',
  'MOBILE_MONEY',
  'MPESA',
  'ORANGE_MONEY',
  'AIRTEL_MONEY',
  'WAVE',
  'CREDIT',
] as const;

export class CreateFinanceAccountDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ACCOUNT_KINDS })
  @IsIn(ACCOUNT_KINDS)
  kind: (typeof ACCOUNT_KINDS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  openingBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iban?: string;
}

export class UpdateFinanceAccountDto extends PartialType(CreateFinanceAccountDto) {
  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class CreateFinanceCategoryDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: CATEGORY_KINDS })
  @IsIn(CATEGORY_KINDS)
  kind: (typeof CATEGORY_KINDS)[number];
}

export class CreateFinanceMovementDto {
  @ApiProperty({ enum: MOVEMENT_KINDS })
  @IsIn(MOVEMENT_KINDS)
  kind: (typeof MOVEMENT_KINDS)[number];

  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  destAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number];

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateFinanceBudgetDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  year: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number | null;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFinanceBudgetDto extends PartialType(CreateFinanceBudgetDto) {}

export class FinanceInventoryLineDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  theoreticalQty: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  countedQty: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitValue: number;
}

export class CreateFinanceInventoryDto {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [FinanceInventoryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinanceInventoryLineDto)
  lines: FinanceInventoryLineDto[];
}
