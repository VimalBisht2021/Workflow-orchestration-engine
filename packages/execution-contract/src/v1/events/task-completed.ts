import { WebhookEvent, WebhookPayload } from './execution-event';

export interface TaskCompletedPayload extends WebhookPayload {
  output: unknown;
}

export type TaskCompletedEvent = WebhookEvent<'TASK_COMPLETED', TaskCompletedPayload>;
