import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { OrdersModule } from './orders/orders.module';
import { ToursModule } from './tours/tours.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { PaymentsModule } from './payments/payments.module';
import { ConsignesModule } from './consignes/consignes.module';
import { SyncModule } from './sync/sync.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmmapureModule } from './emmapure/emmapure.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { AssistantModule } from './assistant/assistant.module';
import { IotModule } from './iot/iot.module';
import { RoutingModule } from './routing/routing.module';
import { EsgModule } from './esg/esg.module';
import { PortalModule } from './portal/portal.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SecurityModule } from './security/security.module';
import { PreferencesModule } from './preferences/preferences.module';
import { SearchModule } from './search/search.module';
import { HrModule } from './hr/hr.module';
import { PricingModule } from './pricing/pricing.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProductsModule,
    VehiclesModule,
    StockModule,
    OrdersModule,
    ToursModule,
    DeliveriesModule,
    PaymentsModule,
    ConsignesModule,
    SyncModule,
    DashboardModule,
    EmmapureModule,
    NotificationsModule,
    AiModule,
    AssistantModule,
    IotModule,
    RoutingModule,
    EsgModule,
    PortalModule,
    MarketplaceModule,
    IntegrationsModule,
    SecurityModule,
    PreferencesModule,
    SearchModule,
    HrModule,
    PricingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
