import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PreferencesService } from './preferences.service';

@ApiTags('preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('preferences')
export class PreferencesController {
  constructor(private preferencesService: PreferencesService) {}

  @Get()
  find(@Req() req: { user: { id: string } }) {
    return this.preferencesService.getPreferences(req.user.id);
  }

  @Patch()
  update(
    @Req() req: { user: { id: string } },
    @Body() body: {
      theme?: string;
      emailNotifications?: boolean;
      whatsappNotifications?: boolean;
      dashboardLayout?: unknown;
    },
  ) {
    return this.preferencesService.updatePreferences(req.user.id, body);
  }
}
