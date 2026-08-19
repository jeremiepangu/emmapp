import { Module } from '@nestjs/common';
import { AuthorizationsController } from './authorizations.controller';
import { AuthorizationsService } from './authorizations.service';

@Module({
  controllers: [AuthorizationsController],
  providers: [AuthorizationsService],
  exports: [AuthorizationsService],
})
export class AuthorizationsModule {}
