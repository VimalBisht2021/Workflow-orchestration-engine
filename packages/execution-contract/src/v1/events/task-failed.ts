import { WebhookEvent, WebhookPayload } from './execution-event';

export interface TaskFailedPayload extends WebhookPayload {
  error: unknown;
}

export type TaskFailedEvent = WebhookEvent<'TASK_FAILED', TaskFailedPayload>;
