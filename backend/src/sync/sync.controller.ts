import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncBatchDto } from './dto/sync.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('push')
  push(
    @Body() dto: SyncBatchDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.syncService.pushBatch(req.user.id, dto.deviceId, dto);
  }

  @Get('pull')
  pull(@Query('since') since?: string) {
    return this.syncService.pullUpdates(since);
  }
}
