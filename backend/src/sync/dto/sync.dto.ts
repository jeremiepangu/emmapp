import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SyncItemDto {
  @ApiProperty()
  @IsString()
  localId: string;

  @ApiProperty({ example: 'delivery' })
  @IsString()
  entityType: string;

  @ApiProperty()
  @IsObject()
  payload: Record<string, unknown>;
}

export class SyncBatchDto {
  @ApiProperty()
  @IsString()
  deviceId: string;

  @ApiProperty({ type: [SyncItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  items: SyncItemDto[];
}
