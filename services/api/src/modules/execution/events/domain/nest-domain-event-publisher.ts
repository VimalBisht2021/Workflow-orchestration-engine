import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEventPublisher } from './domain-event-publisher.interface';
import { DomainEvent } from './domain-events';

@Injectable()
export class NestDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.constructor.name;
    // We can emit asynchronously. The engine will pick it up.
    this.eventEmitter.emitAsync(eventName, event).catch((err) => {
      console.error(`Error emitting event ${eventName}`, err);
    });
  }
}
