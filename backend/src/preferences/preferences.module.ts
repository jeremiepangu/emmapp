import { Module } from '@nestjs/common';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { SavedViewsController } from './saved-views.controller';

@Module({
  controllers: [PreferencesController, SavedViewsController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
