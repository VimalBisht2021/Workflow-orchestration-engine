import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { TaskExecutionGateway } from '../dispatchers/task-execution-gateway.interface';
import { TASK_EXECUTION_GATEWAY } from '../dispatchers/task-execution-gateway.interface';
import type { DomainEventPublisher } from '../events/domain/domain-event-publisher.interface';
import { DOMAIN_EVENT_PUBLISHER } from '../events/domain/domain-event-publisher.interface';
import {
  TaskCompletedDomainEvent,
  TaskFailedDomainEvent,
} from '../events/domain/domain-events';

@Injectable()
export class ReconciliationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ReconciliationService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TASK_EXECUTION_GATEWAY)
    private readonly taskGateway: TaskExecutionGateway,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  onApplicationBootstrap() {
    // Run background reconciliation every 30 seconds
    this.timer = setInterval(() => {
      this.reconcileStalledTasks().catch((err) => {
        this.logger.error(`Error during reconciliation cycle: ${err.message}`);
      });
    }, 30000);
    this.logger.log('ReconciliationService started (polling interval: 30s)');
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Reconciles all tasks in SCHEDULED or RUNNING state that haven't been updated recently.
   */
  async reconcileStalledTasks(staleThresholdMs = 45000): Promise<number> {
    const threshold = new Date(Date.now() - staleThresholdMs);

    const stalledTasks = await this.prisma.taskRun.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RUNNING'] },
        updatedAt: { lte: threshold },
      },
      include: {
        workflowRun: true,
      },
    });

    if (stalledTasks.length === 0) {
      return 0;
    }

    this.logger.log(
      `Found ${stalledTasks.length} stalled tasks eligible for DTP reconciliation`,
    );

    let reconciled = 0;
    for (const task of stalledTasks) {
      const isReconciled = await this.reconcileTask(task);
      if (isReconciled) reconciled++;
    }

    return reconciled;
  }

  /**
   * Reconciles a specific workflow run's active tasks on-demand.
   */
  async reconcileWorkflowRun(workflowRunId: string): Promise<number> {
    const activeTasks = await this.prisma.taskRun.findMany({
      where: {
        workflowRunId,
        status: { in: ['SCHEDULED', 'RUNNING'] },
      },
      include: {
        workflowRun: true,
      },
    });

    let reconciled = 0;
    for (const task of activeTasks) {
      const isReconciled = await this.reconcileTask(task);
      if (isReconciled) reconciled++;
    }

    return reconciled;
  }

  private async reconcileTask(task: any): Promise<boolean> {
    const idempotencyKey = `${task.workflowRunId}:${task.id}`;

    try {
      if (!this.taskGateway.getJobStatus) {
        return false;
      }

      const job = await this.taskGateway.getJobStatus(idempotencyKey);
      if (!job) {
        // If task has been stuck in SCHEDULED for over 45s and never arrived at DTP,
        // it was aborted or lost pre-dispatch. Mark as failed so workflow does not hang indefinitely.
        const staleThresholdMs = 45000;
        const isStaleScheduled =
          task.status === 'SCHEDULED' &&
          task.updatedAt &&
          new Date(task.updatedAt).getTime() < Date.now() - staleThresholdMs;

        if (isStaleScheduled) {
          const timeoutErr = 'Task dispatch timed out or failed pre-dispatch validation.';
          this.logger.warn(
            `Reconciliation: Task ${task.id} stuck in SCHEDULED without remote job. Transitioning to FAILED.`,
          );
          await this.prisma.taskRun.update({
            where: { id: task.id },
            data: {
              status: 'FAILED',
              error: timeoutErr,
              completedAt: new Date(),
            },
          });
          await this.eventPublisher.publish(
            new TaskFailedDomainEvent(task.workflowRunId, task.id, timeoutErr),
          );
          return true;
        }
        return false;
      }

      if (job.status === 'COMPLETED') {
        const output = job.result?.payload ?? job.output ?? null;
        this.logger.log(
          `Reconciliation: Task ${task.id} completed in DTP. Updating state.`,
        );

        await this.prisma.taskRun.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            output,
            completedAt: new Date(),
          },
        });

        await this.eventPublisher.publish(
          new TaskCompletedDomainEvent(task.workflowRunId, task.id, output),
        );
        return true;
      } else if (job.status === 'FAILED') {
        const error = job.failureReason ?? 'Task failed in remote execution platform';
        this.logger.warn(
          `Reconciliation: Task ${task.id} failed in DTP. Updating state.`,
        );

        await this.prisma.taskRun.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            error,
            completedAt: new Date(),
          },
        });

        await this.eventPublisher.publish(
          new TaskFailedDomainEvent(task.workflowRunId, task.id, error),
        );
        return true;
      }

      return false;
    } catch (err: any) {
      this.logger.debug(
        `Failed to reconcile task ${task.id}: ${err.message}`,
      );
      return false;
    }
  }
}
