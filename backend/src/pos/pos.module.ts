import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [PricingModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
