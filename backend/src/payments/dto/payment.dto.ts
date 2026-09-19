import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deliveryId?: string;

  @ApiPropertyOptional({ description: 'Commande reglee par ce versement' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
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
  localId?: string;

  @ApiPropertyOptional({
    description:
      'Encaisser en avance : le montant reste au credit du client au lieu '
      + 'd etre impute sur ses commandes en cours.',
  })
  @IsOptional()
  @IsBoolean()
  asAdvance?: boolean;
}
