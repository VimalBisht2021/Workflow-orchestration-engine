import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IntegrationEventPublisher } from './integration-event-publisher.interface';
import { IntegrationEvent } from './integration-events';

@Injectable()
export class NestIntegrationEventPublisher implements IntegrationEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish(event: IntegrationEvent): Promise<void> {
    const eventName = `integration.${event.constructor.name}`;
    this.eventEmitter.emitAsync(eventName, event).catch((err) => {
      console.error(`Error emitting integration event ${eventName}`, err);
    });
  }
}
