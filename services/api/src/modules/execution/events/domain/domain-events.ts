export interface DomainEvent {
  occurredAt: Date;
}

export interface WorkflowDomainEvent extends DomainEvent {
  workflowRunId: string;
}

export interface TaskDomainEvent extends WorkflowDomainEvent {
  taskRunId: string;
}

export class WorkflowStartedDomainEvent implements WorkflowDomainEvent {
  constructor(
    public readonly workflowRunId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class WorkflowCompletedDomainEvent implements WorkflowDomainEvent {
  constructor(
    public readonly workflowRunId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class WorkflowFailedDomainEvent implements WorkflowDomainEvent {
  constructor(
    public readonly workflowRunId: string,
    public readonly error: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class TaskCompletedDomainEvent implements TaskDomainEvent {
  constructor(
    public readonly workflowRunId: string,
    public readonly taskRunId: string,
    public readonly output: any,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class TaskFailedDomainEvent implements TaskDomainEvent {
  constructor(
    public readonly workflowRunId: string,
    public readonly taskRunId: string,
    public readonly error: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
