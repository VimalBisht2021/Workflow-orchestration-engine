export type WebhookEventType =
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_CANCELLED';

export interface WebhookPayload {
  taskRunId: string;
  workflowRunId: string;
  workflowVersion: number;
  correlationId: string;
  output?: unknown;
  error?: unknown;
}

export interface WebhookEvent<T extends WebhookEventType = WebhookEventType, P extends WebhookPayload = WebhookPayload> {
  eventId: string;
  specVersion: string;
  eventType: T;
  occurredAt: string;
  payload: P;
}
