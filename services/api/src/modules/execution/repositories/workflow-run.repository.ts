import { WorkflowRun } from '../entities/workflow-run.entity';

export const WORKFLOW_RUN_REPOSITORY = 'WORKFLOW_RUN_REPOSITORY';

export interface WorkflowRunRepository {
  create(run: WorkflowRun): Promise<WorkflowRun>;
  findById(id: string): Promise<WorkflowRun | null>;
  update(id: string, partial: Partial<WorkflowRun>): Promise<WorkflowRun>;

  /**
   * Reconstructs the replay lineage chain for a given workflow run.
   * Follows replayedFromId links to build an ordered array:
   * [oldest ancestor, ..., given run]
   */
  findReplayChain(workflowRunId: string): Promise<WorkflowRun[]>;
}
