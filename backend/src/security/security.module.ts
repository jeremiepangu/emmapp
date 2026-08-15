import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MfaService } from './mfa.service';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SecurityController],
  providers: [SecurityService, MfaService],
  exports: [SecurityService, MfaService],
})
export class SecurityModule {}
