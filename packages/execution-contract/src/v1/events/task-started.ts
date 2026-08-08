import { WebhookEvent, WebhookPayload } from './execution-event';

export type TaskStartedEvent = WebhookEvent<'TASK_STARTED', WebhookPayload>;
