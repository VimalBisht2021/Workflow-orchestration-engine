import { Injectable, Inject } from '@nestjs/common';
import { FailureStrategy } from './failure-strategy.interface';
import { WorkflowRun } from '../entities/workflow-run.entity';
import type { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WORKFLOW_RUN_REPOSITORY } from '../repositories/workflow-run.repository';

@Injectable()
export class FailFastStrategy implements FailureStrategy {
  constructor(
    @Inject(WORKFLOW_RUN_REPOSITORY)
    private readonly workflowRunRepository: WorkflowRunRepository,
  ) {}

  async handleWorkflowFailure(workflowRun: WorkflowRun): Promise<void> {
    if (!workflowRun.isFailed()) {
      workflowRun.fail();
      await this.workflowRunRepository.update(workflowRun.id, {
        status: workflowRun.status,
        completedAt: workflowRun.completedAt,
      });
    }

    // In a Fail Fast strategy, we also want to mark any pending/scheduled tasks as skipped.
    // Let's assume ExecutionEngine takes care of updating TaskRuns since FailureStrategy
    // is just about deciding the workflow's fate. Or this strategy could do it.
    // For now, the workflowRun is marked failed. The reconciler handles pending tasks if needed.
  }
}
