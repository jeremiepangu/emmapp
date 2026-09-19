import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTourDto {
  @ApiProperty()
  @IsString()
  zone: string;

  @ApiProperty({ example: '2026-08-11' })
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsUUID()
  driverId: string;

  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds?: string[];
}

export class FieldTourDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ example: '2026-08-11' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class TourUnsoldLineDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordTourUnsoldDto {
  @ApiProperty({ type: [TourUnsoldLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TourUnsoldLineDto)
  lines: TourUnsoldLineDto[];
}

export class UpdateTourDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ example: '2026-08-11' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds?: string[];
}
