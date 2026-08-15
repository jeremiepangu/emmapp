import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PreferencesService } from './preferences.service';

@ApiTags('saved-views')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saved-views')
export class SavedViewsController {
  constructor(private preferencesService: PreferencesService) {}

  @Get()
  findAll(@Req() req: { user: { id: string } }, @Query('resource') resource?: string) {
    return this.preferencesService.findViews(req.user.id, resource);
  }

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Body()
    body: { resource?: string; name?: string; filters?: unknown; isDefault?: boolean },
  ) {
    return this.preferencesService.createView(req.user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.preferencesService.removeView(req.user.id, id);
  }
}
