import { WorkflowRunStatus } from '@prisma/client';
import { InvalidWorkflowRunStateTransitionError } from '../exceptions/execution.exception';
import { TaskRun } from './task-run.entity';

export class WorkflowRun {
  public taskRuns: TaskRun[] = [];
  public replayedFromId?: string | null;

  constructor(
    public readonly id: string,
    public readonly workflowId: string,
    public readonly workflowVersion: number,
    public status: WorkflowRunStatus,
    public queuedAt: Date | null,
    public startedAt: Date | null,
    public completedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isPending(): boolean {
    return this.status === WorkflowRunStatus.PENDING;
  }

  isRunning(): boolean {
    return this.status === WorkflowRunStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === WorkflowRunStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === WorkflowRunStatus.FAILED;
  }

  isCancelled(): boolean {
    return this.status === WorkflowRunStatus.CANCELLED;
  }

  isTerminal(): boolean {
    return this.isCompleted() || this.isFailed() || this.isCancelled();
  }

  queue(queuedAt: Date = new Date()): void {
    if (!this.isPending()) {
      throw new InvalidWorkflowRunStateTransitionError(
        this.id,
        this.status,
        WorkflowRunStatus.PENDING,
      );
    }
    // We could introduce a QUEUED state later if needed,
    // but for now PENDING with queuedAt signifies it's in the queue
    this.queuedAt = queuedAt;
  }

  start(startedAt: Date = new Date()): void {
    if (!this.isPending()) {
      throw new InvalidWorkflowRunStateTransitionError(
        this.id,
        this.status,
        WorkflowRunStatus.RUNNING,
      );
    }
    this.status = WorkflowRunStatus.RUNNING;
    this.startedAt = startedAt;
  }

  complete(completedAt: Date = new Date()): void {
    if (!this.isRunning()) {
      throw new InvalidWorkflowRunStateTransitionError(
        this.id,
        this.status,
        WorkflowRunStatus.COMPLETED,
      );
    }

    // Validate that all tasks are terminal and none failed
    const hasIncompleteTasks = this.taskRuns.some((t) => !t.isTerminal());
    if (hasIncompleteTasks) {
      throw new Error(
        `Cannot complete WorkflowRun ${this.id} with non-terminal tasks`,
      );
    }

    const hasFailedTasks = this.taskRuns.some((t) => t.isFailed());
    if (hasFailedTasks) {
      throw new Error(
        `Cannot complete WorkflowRun ${this.id} because it has failed tasks`,
      );
    }

    this.status = WorkflowRunStatus.COMPLETED;
    this.completedAt = completedAt;
  }

  fail(completedAt: Date = new Date()): void {
    if (!this.isRunning() && !this.isPending()) {
      throw new InvalidWorkflowRunStateTransitionError(
        this.id,
        this.status,
        WorkflowRunStatus.FAILED,
      );
    }
    this.status = WorkflowRunStatus.FAILED;
    this.completedAt = completedAt;
  }

  cancel(completedAt: Date = new Date()): void {
    if (this.isTerminal()) {
      throw new InvalidWorkflowRunStateTransitionError(
        this.id,
        this.status,
        WorkflowRunStatus.CANCELLED,
      );
    }
    this.status = WorkflowRunStatus.CANCELLED;
    this.completedAt = completedAt;
  }
}
