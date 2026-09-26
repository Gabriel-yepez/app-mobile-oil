import { Module } from '@nestjs/common';
import {
  PrismaPlanUsageRepository,
  PrismaSubscriptionRepository,
} from '../../infra/prisma/prisma-subscription.repository';
import { PLAN_USAGE_REPOSITORY } from './domain/plan-usage.repository';
import { SUBSCRIPTION_REPOSITORY } from './domain/subscription.repository';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// No importa OilModule: es OilModule el que importa este para aplicar los
// topes. Los conteos salen de un puerto propio (PLAN_USAGE_REPOSITORY).
@Module({
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: PrismaSubscriptionRepository,
    },
    { provide: PLAN_USAGE_REPOSITORY, useClass: PrismaPlanUsageRepository },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
