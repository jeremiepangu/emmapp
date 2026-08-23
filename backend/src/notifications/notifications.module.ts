import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, WhatsappService],
  exports: [NotificationsService, EmailService, WhatsappService],
})
export class NotificationsModule {}
