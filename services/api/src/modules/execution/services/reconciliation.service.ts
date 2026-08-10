import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ExecutionClient } from '@local/execution-sdk';
import { ConfigService } from '@nestjs/config';
import type { DomainEventPublisher } from '../events/domain/domain-event-publisher.interface';
import { DOMAIN_EVENT_PUBLISHER } from '../events/domain/domain-event-publisher.interface';
import {
  TaskCompletedDomainEvent,
  TaskFailedDomainEvent,
} from '../events/domain/domain-events';

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly executionClient: ExecutionClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {
    this.executionClient = new ExecutionClient({
      baseUrl: this.configService.getOrThrow<string>('DTP_BASE_URL'),
      apiKey: this.configService.getOrThrow<string>('DTP_API_KEY'),
      webhookUrl: this.configService.get<string>('WOE_WEBHOOK_URL', ''),
    });
  }

  onModuleInit() {
    // Run every 5 minutes
    const intervalMs = 5 * 60 * 1000;
    this.timer = setInterval(() => {
      this.reconcileStrandedTasks().catch((err) => {
        this.logger.error(
          `Unhandled error in reconcileStrandedTasks: ${err.message}`,
        );
      });
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async reconcileStrandedTasks() {
    this.logger.debug('Running stranded tasks reconciliation...');
    try {
      // Find tasks that are SCHEDULED or RUNNING and haven't been updated in 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const strandedTasks = await this.prisma.taskRun.findMany({
        where: {
          status: { in: ['SCHEDULED', 'RUNNING'] },
          updatedAt: { lt: tenMinutesAgo },
        },
      });

      for (const task of strandedTasks) {
        try {
          const idempotencyKey = `${task.workflowRunId}:${task.id}`;
          const jobStatus =
            await this.executionClient.getJobStatus(idempotencyKey);

          if (!jobStatus) {
            this.logger.warn(
              `Job for TaskRun ${task.id} not found in DTP. Leaving as-is until idempotencyKey lookup is supported.`,
            );
            continue;
          }

          // Job found, check if it's terminal
          const status = jobStatus.status;
          if (status === 'COMPLETED') {
            this.logger.log(`Reconciling TaskRun ${task.id} as COMPLETED`);
            await this.prisma.$transaction(async (tx) => {
              const currentTask = await tx.taskRun.findUnique({
                where: { id: task.id },
                select: { status: true },
              });
              if (
                !currentTask ||
                ['COMPLETED', 'FAILED', 'SKIPPED'].includes(currentTask.status)
              )
                return;

              await tx.taskRun.update({
                where: { id: task.id },
                data: {
                  status: 'COMPLETED',
                  output: jobStatus.result || null,
                  completedAt: new Date(jobStatus.updatedAt || Date.now()),
                },
              });
              await this.eventPublisher.publish(
                new TaskCompletedDomainEvent(
                  task.workflowRunId,
                  task.id,
                  jobStatus.result,
                  new Date(jobStatus.updatedAt || Date.now()),
                ),
              );
            });
          } else if (status === 'FAILED') {
            this.logger.log(`Reconciling TaskRun ${task.id} as FAILED`);
            const errorMsg = jobStatus.error || 'Task failed in DTP';
            await this.markTaskFailed(
              task.id,
              task.workflowRunId,
              errorMsg,
              new Date(jobStatus.updatedAt || Date.now()),
            );
          }
        } catch (e: any) {
          this.logger.error(
            `Error reconciling TaskRun ${task.id}: ${e.message}`,
          );
        }
      }
    } catch (e: any) {
      this.logger.error(`Failed to run reconciliation: ${e.message}`);
    }
  }

  private async markTaskFailed(
    taskRunId: string,
    workflowRunId: string,
    error: string,
    completedAt = new Date(),
  ) {
    await this.prisma.$transaction(async (tx) => {
      const currentTask = await tx.taskRun.findUnique({
        where: { id: taskRunId },
        select: { status: true },
      });
      if (
        !currentTask ||
        ['COMPLETED', 'FAILED', 'SKIPPED'].includes(currentTask.status)
      )
        return;

      await tx.taskRun.update({
        where: { id: taskRunId },
        data: {
          status: 'FAILED',
          error,
          completedAt,
        },
      });

      await this.eventPublisher.publish(
        new TaskFailedDomainEvent(workflowRunId, taskRunId, error, completedAt),
      );
    });
  }
}
