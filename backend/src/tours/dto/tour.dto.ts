import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
