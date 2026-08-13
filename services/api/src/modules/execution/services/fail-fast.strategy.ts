import { Injectable, Inject, Logger } from '@nestjs/common';
import { FailureStrategy } from './failure-strategy.interface';
import { WorkflowRun } from '../entities/workflow-run.entity';
import type { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WORKFLOW_RUN_REPOSITORY } from '../repositories/workflow-run.repository';
import type { TaskExecutionGateway } from '../dispatchers/task-execution-gateway.interface';
import { TASK_EXECUTION_GATEWAY } from '../dispatchers/task-execution-gateway.interface';
import type { TaskRunRepository } from '../repositories/task-run.repository';
import { TASK_RUN_REPOSITORY } from '../repositories/task-run.repository';

@Injectable()
export class FailFastStrategy implements FailureStrategy {
  private readonly logger = new Logger(FailFastStrategy.name);

  constructor(
    @Inject(WORKFLOW_RUN_REPOSITORY)
    private readonly workflowRunRepository: WorkflowRunRepository,
    @Inject(TASK_EXECUTION_GATEWAY)
    private readonly taskGateway: TaskExecutionGateway,
    @Inject(TASK_RUN_REPOSITORY)
    private readonly taskRunRepository: TaskRunRepository,
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
    // Also we want to cancel any tasks running in DTP.
    for (const taskRun of workflowRun.taskRuns) {
      if (!taskRun.isTerminal()) {
        const idempotencyKey = `${workflowRun.id}:${taskRun.id}`;
        // Attempt to cancel in DTP (ignoring errors if it's too late)
        await this.taskGateway.cancel(idempotencyKey).catch(err => {
          this.logger.warn(`Failed to cancel task ${taskRun.id} in DTP during fail-fast: ${err.message}`);
        });

        // Mark as cancelled locally
        await this.taskRunRepository.atomicUpdateStatus(taskRun.id, 'PENDING', 'SKIPPED');
        await this.taskRunRepository.atomicUpdateStatus(taskRun.id, 'SCHEDULED', 'SKIPPED');
        await this.taskRunRepository.atomicUpdateStatus(taskRun.id, 'RUNNING', 'SKIPPED');
        
        await this.taskRunRepository.update(taskRun.id, {
          completedAt: new Date(),
        });
      }
    }
  }
}
