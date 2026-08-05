import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookEventDto } from '../dto/webhook-event.dto';
import type { TaskRunRepository } from '../repositories/task-run.repository';
import { TASK_RUN_REPOSITORY } from '../repositories/task-run.repository';
import type { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WORKFLOW_RUN_REPOSITORY } from '../repositories/workflow-run.repository';
import type { DomainEventPublisher } from '../events/domain/domain-event-publisher.interface';
import { DOMAIN_EVENT_PUBLISHER } from '../events/domain/domain-event-publisher.interface';
import {
  TaskCompletedDomainEvent,
  TaskFailedDomainEvent,
} from '../events/domain/domain-events';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

@Controller('api/webhooks/tasks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    @Inject(TASK_RUN_REPOSITORY)
    private readonly taskRunRepository: TaskRunRepository,
    @Inject(WORKFLOW_RUN_REPOSITORY)
    private readonly workflowRunRepository: WorkflowRunRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.webhookSecret = configService.get<string>('WEBHOOK_SECRET', 'secret');
  }

  @Post('events')
  @HttpCode(202)
  async handleEvent(
    @Headers('x-signature') signature: string,
    @Body() body: WebhookEventDto,
  ): Promise<void> {
    // 1. Authenticate — HMAC-SHA256 signature verification
    if (!this.verifySignature(signature, body)) {
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log(
      `Received webhook event: ${body.eventType} ` +
        `(eventId=${body.eventId}, taskRunId=${body.payload.taskRunId})`,
    );

    // 2. Idempotency — check if eventId was already processed (database-backed)
    const alreadyProcessed = await this.isEventProcessed(body.eventId);
    if (alreadyProcessed) {
      this.logger.warn(
        `Event ${body.eventId} already processed. Ignoring duplicate.`,
      );
      return;
    }

    // 3. Validate taskRunId exists
    const taskRun = await this.taskRunRepository.findById(
      body.payload.taskRunId,
    );
    if (!taskRun) {
      throw new BadRequestException(
        `TaskRun ${body.payload.taskRunId} not found`,
      );
    }

    // 4. Validate workflowRunId matches
    if (taskRun.workflowRunId !== body.payload.workflowRunId) {
      throw new BadRequestException(
        `TaskRun ${body.payload.taskRunId} does not belong to ` +
          `workflow run ${body.payload.workflowRunId}`,
      );
    }

    // 5. Validate workflowVersion matches
    const workflowRun = await this.workflowRunRepository.findById(
      body.payload.workflowRunId,
    );
    if (!workflowRun) {
      throw new BadRequestException(
        `WorkflowRun ${body.payload.workflowRunId} not found`,
      );
    }
    if (workflowRun.workflowVersion !== body.payload.workflowVersion) {
      throw new BadRequestException(
        `Version mismatch: WorkflowRun version is ` +
          `${workflowRun.workflowVersion}, but callback says ` +
          `${body.payload.workflowVersion}`,
      );
    }

    // 6. Idempotency — ignore if task is already terminal
    if (taskRun.isTerminal()) {
      this.logger.warn(
        `TaskRun ${taskRun.id} is already in terminal state ` +
          `${taskRun.status}. Ignoring event ${body.eventId}.`,
      );
      await this.markEventProcessed(body.eventId, body.payload.correlationId);
      return;
    }

    // 7. Process the event
    const occurredAt = new Date(body.occurredAt);

    switch (body.eventType) {
      case 'TASK_STARTED': {
        if (taskRun.isScheduled()) {
          taskRun.start(occurredAt);
          await this.taskRunRepository.update(taskRun.id, {
            status: taskRun.status,
            startedAt: taskRun.startedAt,
          });
        }
        // No reconciliation needed for TASK_STARTED
        break;
      }

      case 'TASK_COMPLETED': {
        taskRun.complete(body.payload.output, occurredAt);
        await this.taskRunRepository.update(taskRun.id, {
          status: taskRun.status,
          output: taskRun.output,
          completedAt: taskRun.completedAt,
        });

        await this.eventPublisher.publish(
          new TaskCompletedDomainEvent(
            body.payload.workflowRunId,
            body.payload.taskRunId,
            body.payload.output,
            occurredAt,
          ),
        );
        break;
      }

      case 'TASK_FAILED': {
        const errorMsg =
          typeof body.payload.error === 'string'
            ? body.payload.error
            : JSON.stringify(body.payload.error ?? 'Unknown Error');

        taskRun.fail(errorMsg, occurredAt);
        await this.taskRunRepository.update(taskRun.id, {
          status: taskRun.status,
          error: taskRun.error,
          completedAt: taskRun.completedAt,
        });

        await this.eventPublisher.publish(
          new TaskFailedDomainEvent(
            body.payload.workflowRunId,
            body.payload.taskRunId,
            errorMsg,
            occurredAt,
          ),
        );
        break;
      }

      case 'TASK_CANCELLED': {
        // Cancellation is treated as a skip from WOE's perspective
        taskRun.skip(occurredAt);
        await this.taskRunRepository.update(taskRun.id, {
          status: taskRun.status,
          completedAt: taskRun.completedAt,
        });

        // Trigger reconciliation — cancelled tasks may unblock workflow completion
        await this.eventPublisher.publish(
          new TaskFailedDomainEvent(
            body.payload.workflowRunId,
            body.payload.taskRunId,
            'Task cancelled by DTP',
            occurredAt,
          ),
        );
        break;
      }
    }

    // 8. Mark event as processed
    await this.markEventProcessed(body.eventId, body.payload.correlationId);
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private verifySignature(signature: string, body: unknown): boolean {
    if (!signature) return false;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  private async isEventProcessed(eventId: string): Promise<boolean> {
    const existing = await this.prisma.processedWebhookEvent.findUnique({
      where: { eventId },
    });
    return existing !== null;
  }

  private async markEventProcessed(
    eventId: string,
    correlationId?: string,
  ): Promise<void> {
    await this.prisma.processedWebhookEvent.create({
      data: {
        eventId,
        correlationId: correlationId ?? null,
      },
    });
  }
}
