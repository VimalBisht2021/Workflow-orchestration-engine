import { TaskRun } from '../entities/task-run.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';

export interface TaskExecutionContext {
  taskRun: TaskRun;
  workflowRun: WorkflowRun;
  input: any;
  // Extensibility for later
  // variables: Record<string, any>;
  // logger: any;
  // cancellationToken: any;
}

export interface TaskHandler<TOutput = any> {
  getName(): string;
  execute(context: TaskExecutionContext): Promise<TOutput>;
}
