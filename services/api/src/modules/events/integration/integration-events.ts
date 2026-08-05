export interface IntegrationEvent {
  occurredAt: Date;
  eventId: string;
  correlationId?: string;
  schemaVersion: number;
}

export class TaskCompletedIntegrationEvent implements IntegrationEvent {
  constructor(
    public readonly eventId: string,
    public readonly workflowRunId: string,
    public readonly taskRunId: string,
    public readonly output: any,
    public readonly occurredAt: Date = new Date(),
    public readonly correlationId?: string,
    public readonly schemaVersion: number = 1,
  ) {}
}

export class TaskFailedIntegrationEvent implements IntegrationEvent {
  constructor(
    public readonly eventId: string,
    public readonly workflowRunId: string,
    public readonly taskRunId: string,
    public readonly error: string,
    public readonly occurredAt: Date = new Date(),
    public readonly correlationId?: string,
    public readonly schemaVersion: number = 1,
  ) {}
}
