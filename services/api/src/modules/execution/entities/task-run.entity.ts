import { TaskRunStatus } from '@prisma/client';
import { InvalidTaskRunStateTransitionError } from '../exceptions/execution.exception';

export class TaskRun {
  constructor(
    public readonly id: string,
    public readonly workflowRunId: string,
    public readonly taskDefinitionId: string,
    public status: TaskRunStatus,
    public input: any | null,
    public output: any | null,
    public error: string | null,
    public queuedAt: Date | null,
    public startedAt: Date | null,
    public completedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isPending(): boolean {
    return this.status === TaskRunStatus.PENDING;
  }

  isScheduled(): boolean {
    return this.status === TaskRunStatus.SCHEDULED;
  }

  isRunning(): boolean {
    return this.status === TaskRunStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === TaskRunStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === TaskRunStatus.FAILED;
  }

  isSkipped(): boolean {
    return this.status === TaskRunStatus.SKIPPED;
  }

  isCancelled(): boolean {
    return this.status === TaskRunStatus.CANCELLED;
  }

  isTerminal(): boolean {
    return this.isCompleted() || this.isFailed() || this.isSkipped() || this.isCancelled();
  }

  schedule(queuedAt: Date = new Date()): void {
    if (!this.isPending()) {
      throw new InvalidTaskRunStateTransitionError(
        this.id,
        this.status,
        TaskRunStatus.SCHEDULED,
      );
    }
    this.status = TaskRunStatus.SCHEDULED;
    this.queuedAt = queuedAt;
  }

  start(startedAt: Date = new Date()): void {
    if (!this.isScheduled()) {
      throw new InvalidTaskRunStateTransitionError(
        this.id,
        this.status,
        TaskRunStatus.RUNNING,
      );
    }
    this.status = TaskRunStatus.RUNNING;
    this.startedAt = startedAt;
  }

  complete(output: any, completedAt: Date = new Date()): void {
    if (!this.isRunning()) {
      throw new InvalidTaskRunStateTransitionError(
        this.id,
        this.status,
        TaskRunStatus.COMPLETED,
      );
    }
    this.status = TaskRunStatus.COMPLETED;
    this.output = output;
    this.completedAt = completedAt;
  }

  fail(error: string, completedAt: Date = new Date()): void {
    if (!this.isRunning()) {
      throw new InvalidTaskRunStateTransitionError(
        this.id,
        this.status,
        TaskRunStatus.FAILED,
      );
    }
    this.status = TaskRunStatus.FAILED;
    this.error = error;
    this.completedAt = completedAt;
  }

  skip(completedAt: Date = new Date()): void {
    if (this.isTerminal() || this.isRunning()) {
      throw new InvalidTaskRunStateTransitionError(
        this.id,
        this.status,
        TaskRunStatus.SKIPPED,
      );
    }
    this.status = TaskRunStatus.SKIPPED;
    this.completedAt = completedAt;
  }

  cancel(completedAt: Date = new Date()): void {
    if (this.isTerminal() || this.isRunning()) {
      throw new InvalidTaskRunStateTransitionError(
        this.id,
        this.status,
        TaskRunStatus.CANCELLED,
      );
    }
    this.status = TaskRunStatus.CANCELLED;
    this.completedAt = completedAt;
  }
}
