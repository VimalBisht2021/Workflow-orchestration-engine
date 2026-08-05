import { WorkflowStatus } from '../enums/workflow-status.enum';
import {
  WorkflowAlreadyPublishedError,
  WorkflowAlreadyValidatedError,
  WorkflowNotValidatedError,
  CyclicDependencyError,
  MissingDependencyError,
} from '../exceptions/domain.exception';
import { TaskDefinition } from './task-definition.entity';

export class Workflow {
  public tasks: TaskDefinition[] = [];

  constructor(
    public readonly id: string,
    public name: string,
    public description: string | undefined,
    public owner: string,
    public tags: string[],
    public version: number,
    public status: WorkflowStatus,
    public createdAt: Date,
  ) {}

  addTask(task: TaskDefinition): void {
    // Basic invariant: Cannot modify tasks if already published
    if (this.status === WorkflowStatus.PUBLISHED) {
      throw new WorkflowAlreadyPublishedError(this.id);
    }

    // Status resets to DRAFT if we mutate the workflow graph
    if (this.status === WorkflowStatus.VALIDATED) {
      this.status = WorkflowStatus.DRAFT;
    }

    this.tasks.push(task);
  }

  validateGraph(): void {
    const taskMap = new Map<string, TaskDefinition>();
    for (const task of this.tasks) {
      taskMap.set(task.id, task);
    }

    // 1. Check for missing dependencies
    for (const task of this.tasks) {
      for (const depId of task.dependencies) {
        if (!taskMap.has(depId)) {
          throw new MissingDependencyError(this.id, task.id, depId);
        }
      }
    }

    // 2. Check for cycles using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const isCyclic = (taskId: string): boolean => {
      if (recStack.has(taskId)) {
        // Cycle detected
        path.push(taskId);
        return true;
      }
      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recStack.add(taskId);
      path.push(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (isCyclic(depId)) {
            return true;
          }
        }
      }

      recStack.delete(taskId);
      path.pop();
      return false;
    };

    for (const task of this.tasks) {
      if (!visited.has(task.id)) {
        if (isCyclic(task.id)) {
          throw new CyclicDependencyError(this.id, [...path]);
        }
      }
    }
  }

  canPublish(): boolean {
    return this.status === WorkflowStatus.VALIDATED;
  }

  canExecute(): boolean {
    return this.status === WorkflowStatus.PUBLISHED;
  }

  validate(): void {
    if (this.status === WorkflowStatus.VALIDATED) {
      throw new WorkflowAlreadyValidatedError(this.id);
    }
    if (this.status === WorkflowStatus.PUBLISHED) {
      throw new WorkflowAlreadyPublishedError(this.id);
    }

    this.validateGraph();
    this.status = WorkflowStatus.VALIDATED;
  }

  publish(): void {
    if (this.status === WorkflowStatus.PUBLISHED) {
      throw new WorkflowAlreadyPublishedError(this.id);
    }
    if (this.status !== WorkflowStatus.VALIDATED) {
      throw new WorkflowNotValidatedError(this.id);
    }

    this.status = WorkflowStatus.PUBLISHED;
  }
}
