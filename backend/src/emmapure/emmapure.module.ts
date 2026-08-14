import { Module } from '@nestjs/common';
import { EmmapureController } from './emmapure.controller';
import { EmmapureService } from './emmapure.service';

@Module({
  controllers: [EmmapureController],
  providers: [EmmapureService],
})
export class EmmapureModule {}
