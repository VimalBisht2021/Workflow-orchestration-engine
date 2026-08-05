import { TaskRun } from '../entities/task-run.entity';

export const TASK_RUN_REPOSITORY = 'TASK_RUN_REPOSITORY';

export interface TaskRunRepository {
  create(run: TaskRun): Promise<TaskRun>;
  findById(id: string): Promise<TaskRun | null>;
  findByWorkflowRunId(workflowRunId: string): Promise<TaskRun[]>;
  update(id: string, partial: Partial<TaskRun>): Promise<TaskRun>;
  atomicUpdateStatus(
    id: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<boolean>;
}
