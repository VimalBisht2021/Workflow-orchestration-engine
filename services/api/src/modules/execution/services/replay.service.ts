import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WORKFLOW_RUN_REPOSITORY } from '../repositories/workflow-run.repository';
import type { TaskRunRepository } from '../repositories/task-run.repository';
import { TASK_RUN_REPOSITORY } from '../repositories/task-run.repository';
import type { WorkflowRepository } from '../../workflow/repositories/workflow.repository';
import { WORKFLOW_REPOSITORY } from '../../workflow/repositories/workflow.repository';
import { WorkflowRunFactory } from './workflow-run.factory';
import type { DomainEventPublisher } from '../events/domain/domain-event-publisher.interface';
import { DOMAIN_EVENT_PUBLISHER } from '../events/domain/domain-event-publisher.interface';
import { WorkflowStartedDomainEvent } from '../events/domain/domain-events';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { TaskRunStatus } from '@prisma/client';

@Injectable()
export class ReplayService {
  constructor(
    @Inject(WORKFLOW_RUN_REPOSITORY)
    private readonly workflowRunRepository: WorkflowRunRepository,
    @Inject(TASK_RUN_REPOSITORY)
    private readonly taskRunRepository: TaskRunRepository,
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
    private readonly workflowRunFactory: WorkflowRunFactory,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /**
   * Creates a new WorkflowRun by replaying a terminal run.
   *
   * Replay rules:
   * | Original  | Replay    |
   * |-----------|-----------|
   * | COMPLETED | COMPLETED |
   * | SKIPPED   | SKIPPED   |
   * | FAILED    | PENDING   |
   *
   * The original run is never mutated. Historical outputs, timestamps,
   * and execution metadata are preserved on replayed COMPLETED/SKIPPED tasks.
   * Lineage is tracked via replayedFromId.
   */
  async replayWorkflow(workflowRunId: string): Promise<WorkflowRun> {
    const originalRun =
      await this.workflowRunRepository.findById(workflowRunId);
    if (!originalRun) {
      throw new NotFoundException(`WorkflowRun ${workflowRunId} not found`);
    }

    // Only terminal workflow runs can be replayed
    if (!originalRun.isTerminal()) {
      throw new BadRequestException(
        `WorkflowRun ${workflowRunId} is in state ${originalRun.status}. ` +
          `Only terminal runs (COMPLETED, FAILED, CANCELLED) can be replayed.`,
      );
    }

    const workflow = await this.workflowRepository.findById(
      originalRun.workflowId,
    );
    if (!workflow) {
      throw new NotFoundException(
        `Workflow ${originalRun.workflowId} not found`,
      );
    }

    // 1. Create a new run using the factory — object creation stays centralized
    const newRun = this.workflowRunFactory.create(workflow);
    newRun.replayedFromId = originalRun.id;

    // 2. Replay historical states
    for (const newTask of newRun.taskRuns) {
      const oldTask = originalRun.taskRuns.find(
        (t) => t.taskDefinitionId === newTask.taskDefinitionId,
      );

      if (oldTask) {
        if (
          oldTask.status === TaskRunStatus.COMPLETED ||
          oldTask.status === TaskRunStatus.SKIPPED
        ) {
          // Preserve completed/skipped state with all historical metadata
          newTask.status = oldTask.status;
          newTask.output = oldTask.output;
          newTask.startedAt = oldTask.startedAt;
          newTask.completedAt = oldTask.completedAt;
          newTask.queuedAt = oldTask.queuedAt;
        } else if (oldTask.status === TaskRunStatus.FAILED) {
          // Failed tasks are reset to PENDING — they will be re-dispatched
          newTask.status = TaskRunStatus.PENDING;
        }
        // All other statuses (PENDING, SCHEDULED, RUNNING) remain PENDING
      }
    }

    // 3. Persist
    await this.workflowRunRepository.create(newRun);
    for (const tr of newRun.taskRuns) {
      await this.taskRunRepository.create(tr);
    }

    // 4. Start execution
    newRun.start();
    await this.workflowRunRepository.update(newRun.id, {
      status: newRun.status,
      startedAt: newRun.startedAt,
    });

    await this.eventPublisher.publish(
      new WorkflowStartedDomainEvent(newRun.id),
    );

    return newRun;
  }
}
