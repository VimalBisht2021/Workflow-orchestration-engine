import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TaskCompletedIntegrationEvent,
  TaskFailedIntegrationEvent,
} from './integration-events';
import type { DomainEventPublisher } from '../../execution/events/domain/domain-event-publisher.interface';
import { DOMAIN_EVENT_PUBLISHER } from '../../execution/events/domain/domain-event-publisher.interface';
import {
  TaskCompletedDomainEvent,
  TaskFailedDomainEvent,
} from '../../execution/events/domain/domain-events';

@Injectable()
export class IntegrationEventConsumer {
  constructor(
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  @OnEvent('integration.TaskCompletedIntegrationEvent')
  async handleTaskCompletedIntegration(event: TaskCompletedIntegrationEvent) {
    // Translate Integration Event to Domain Event
    const domainEvent = new TaskCompletedDomainEvent(
      event.workflowRunId,
      event.taskRunId,
      event.output,
      event.occurredAt,
    );
    await this.domainEventPublisher.publish(domainEvent);
  }

  @OnEvent('integration.TaskFailedIntegrationEvent')
  async handleTaskFailedIntegration(event: TaskFailedIntegrationEvent) {
    // Translate Integration Event to Domain Event
    const domainEvent = new TaskFailedDomainEvent(
      event.workflowRunId,
      event.taskRunId,
      event.error,
      event.occurredAt,
    );
    await this.domainEventPublisher.publish(domainEvent);
  }
}
