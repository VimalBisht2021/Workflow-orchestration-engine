import { DomainEvent } from './domain-events';

export const DOMAIN_EVENT_PUBLISHER = 'DOMAIN_EVENT_PUBLISHER';

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
