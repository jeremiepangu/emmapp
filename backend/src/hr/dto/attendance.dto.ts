import { AttendancePunchType, AttendanceSource } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class AttendancePunchDto {
  @ApiProperty({ enum: AttendancePunchType })
  @IsEnum(AttendancePunchType)
  type: AttendancePunchType;

  @ApiPropertyOptional({ enum: AttendanceSource })
  @IsOptional()
  @IsEnum(AttendanceSource)
  source?: AttendanceSource;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustAttendanceDayDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  workedMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  overtimeMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adjustmentReason?: string;
}

export class ManualPunchDto extends AttendancePunchDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'ISO datetime du pointage (defaut: maintenant)' })
  @IsOptional()
  @IsString()
  punchedAt?: string;
}
