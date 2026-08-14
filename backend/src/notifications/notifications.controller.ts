import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: { user: { id: string } }, @Query('unread') unread?: string) {
    return this.notificationsService.findForUser(req.user.id, unread === 'true');
  }

  @Get('unread-count')
  countUnread(@Req() req: { user: { id: string } }) {
    return this.notificationsService.countUnread(req.user.id).then((count) => ({ count }));
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user: { id: string } }) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.notificationsService.markRead(id, req.user.id);
  }
}
