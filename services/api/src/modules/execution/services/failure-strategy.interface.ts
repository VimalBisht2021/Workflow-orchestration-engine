import { WorkflowRun } from '../entities/workflow-run.entity';

export const FAILURE_STRATEGY = 'FAILURE_STRATEGY';

export interface FailureStrategy {
  handleWorkflowFailure(workflowRun: WorkflowRun): Promise<void>;
}
