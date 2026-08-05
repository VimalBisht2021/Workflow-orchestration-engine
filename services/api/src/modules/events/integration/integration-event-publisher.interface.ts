import { IntegrationEvent } from './integration-events';

export const INTEGRATION_EVENT_PUBLISHER = 'INTEGRATION_EVENT_PUBLISHER';

export interface IntegrationEventPublisher {
  publish(event: IntegrationEvent): Promise<void>;
}
