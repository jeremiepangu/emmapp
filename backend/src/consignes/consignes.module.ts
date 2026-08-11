import { Module } from '@nestjs/common';
import { ConsignesController } from './consignes.controller';
import { ConsignesService } from './consignes.service';

@Module({
  controllers: [ConsignesController],
  providers: [ConsignesService],
  exports: [ConsignesService],
})
export class ConsignesModule {}
