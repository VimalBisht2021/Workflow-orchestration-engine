import { Module } from '@nestjs/common';
import { NestIntegrationEventPublisher } from './integration/nest-integration-event-publisher';
import { INTEGRATION_EVENT_PUBLISHER } from './integration/integration-event-publisher.interface';
import { IntegrationEventConsumer } from './integration/integration-event-consumer';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [ExecutionModule], // Needed to inject DOMAIN_EVENT_PUBLISHER into Consumer
  providers: [
    {
      provide: INTEGRATION_EVENT_PUBLISHER,
      useClass: NestIntegrationEventPublisher,
    },
    IntegrationEventConsumer,
  ],
  exports: [INTEGRATION_EVENT_PUBLISHER],
})
export class EventsModule {}
