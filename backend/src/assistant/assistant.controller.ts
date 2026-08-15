import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssistantChannel, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AssistantService } from './assistant.service';

@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private assistantService: AssistantService) {}

  @Post('query')
  query(
    @Body() body: { question: string; sessionId?: string; channel?: AssistantChannel },
    @Req() req: { user: { id: string; role: UserRole } },
  ) {
    return this.assistantService.ask({
      question: body.question,
      sessionId: body.sessionId,
      channel: body.channel ?? AssistantChannel.BACKOFFICE,
      userId: req.user.id,
      userRole: req.user.role,
    });
  }

  @Get('sessions')
  sessions(@Req() req: { user: { id: string; role: string } }) {
    return this.assistantService.listSessions(req.user);
  }

  @Get('sessions/:id')
  session(@Param('id') id: string, @Req() req: { user: { id: string; role: string } }) {
    return this.assistantService.getSession(id, req.user);
  }

  @Post('sessions/:id/escalate')
  escalate(@Param('id') id: string, @Req() req: { user: { id: string; role: string } }) {
    return this.assistantService.escalateSession(id, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.IT_GED)
  @Post('whatsapp/webhook')
  whatsapp(@Body() body: { from: string; message: string }) {
    return this.assistantService.answerWhatsapp(body);
  }
}
