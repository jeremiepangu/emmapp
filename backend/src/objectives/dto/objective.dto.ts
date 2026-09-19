import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const OBJECTIVE_PERIODS = ['MENSUEL', 'TRIMESTRIEL', 'ANNUEL'] as const;
export const OBJECTIVE_UNITS = ['DECLARATION', 'UNITE', 'LIVRAISON', 'CA'] as const;

export class CreateActivityObjectiveDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  activityId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: OBJECTIVE_PERIODS, default: 'MENSUEL' })
  @IsOptional()
  @IsIn(OBJECTIVE_PERIODS)
  periodType?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  year: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter?: number | null;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetValue: number;

  @ApiPropertyOptional({ enum: OBJECTIVE_UNITS, default: 'DECLARATION' })
  @IsOptional()
  @IsIn(OBJECTIVE_UNITS)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateActivityObjectiveDto extends PartialType(CreateActivityObjectiveDto) {}
