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
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
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
import { Prisma } from '@prisma/client';

@Controller('api/webhooks/tasks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    @Inject(TASK_RUN_REPOSITORY)
    private readonly taskRunRepository: TaskRunRepository, // kept for dependency injection consistency
    @Inject(WORKFLOW_RUN_REPOSITORY)
    private readonly workflowRunRepository: WorkflowRunRepository, // kept for dependency injection consistency
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    // WOE-4: Remove default secret and require it
    this.webhookSecret = configService.getOrThrow<string>('WEBHOOK_SECRET');
  }

  @Post('events')
  @HttpCode(202)
  async handleEvent(
    @Headers('x-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: WebhookEventDto,
  ): Promise<void> {
    // 1. Authenticate — HMAC-SHA256 signature verification over exact raw bytes
    if (!this.verifySignature(signature, req.rawBody)) {
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log(
      `Received webhook event: ${body.eventType} ` +
        `(eventId=${body.eventId}, taskRunId=${body.payload.taskRunId})`,
    );

    // WOE-3: Atomic deduplication with a single transaction
    try {
      await this.prisma.$transaction(async (tx) => {
        // 2. Idempotency — atomic insert to dedup
        await tx.processedWebhookEvent.create({
          data: {
            eventId: body.eventId,
            correlationId: body.payload.correlationId ?? null,
          },
        });

        // 3. Validate taskRunId exists
        const taskRunModel = await tx.taskRun.findUnique({
          where: { id: body.payload.taskRunId },
        });

        if (!taskRunModel) {
          throw new BadRequestException(
            `TaskRun ${body.payload.taskRunId} not found`,
          );
        }

        // 4. Validate workflowRunId matches
        if (taskRunModel.workflowRunId !== body.payload.workflowRunId) {
          throw new BadRequestException(
            `TaskRun ${body.payload.taskRunId} does not belong to ` +
              `workflow run ${body.payload.workflowRunId}`,
          );
        }

        // 5. Validate workflowVersion matches
        const workflowRunModel = await tx.workflowRun.findUnique({
          where: { id: body.payload.workflowRunId },
        });

        if (!workflowRunModel) {
          throw new BadRequestException(
            `WorkflowRun ${body.payload.workflowRunId} not found`,
          );
        }
        if (workflowRunModel.workflowVersion !== body.payload.workflowVersion) {
          throw new BadRequestException(
            `Version mismatch: WorkflowRun version is ` +
              `${workflowRunModel.workflowVersion}, but callback says ` +
              `${body.payload.workflowVersion}`,
          );
        }

        // 6. Idempotency — ignore if task is already terminal
        const terminalStatuses = ['COMPLETED', 'FAILED', 'SKIPPED'];
        if (terminalStatuses.includes(taskRunModel.status)) {
          this.logger.warn(
            `TaskRun ${taskRunModel.id} is already in terminal state ` +
              `${taskRunModel.status}. Ignoring event ${body.eventId}.`,
          );
          return;
        }

        // 7. Process the event
        const occurredAt = new Date(body.occurredAt);

        switch (body.eventType) {
          case 'TASK_STARTED': {
            if (taskRunModel.status === 'SCHEDULED') {
              this.logger.log(
                `Task transitioning to RUNNING (workflowRunId=${body.payload.workflowRunId}, taskRunId=${body.payload.taskRunId}, correlationId=${body.payload.correlationId})`,
              );
              await tx.taskRun.update({
                where: { id: taskRunModel.id },
                data: {
                  status: 'RUNNING',
                  startedAt: occurredAt,
                },
              });
            }
            // No reconciliation needed for TASK_STARTED
            break;
          }

          case 'TASK_COMPLETED': {
            this.logger.log(
              `Task transitioning to COMPLETED (workflowRunId=${body.payload.workflowRunId}, taskRunId=${body.payload.taskRunId}, correlationId=${body.payload.correlationId})`,
            );
            await tx.taskRun.update({
              where: { id: taskRunModel.id },
              data: {
                status: 'COMPLETED',
                output: body.payload.output
                  ? (body.payload.output as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
                completedAt: occurredAt,
              },
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
            this.logger.log(
              `Task transitioning to FAILED (workflowRunId=${body.payload.workflowRunId}, taskRunId=${body.payload.taskRunId}, correlationId=${body.payload.correlationId})`,
            );
            const errorMsg =
              typeof body.payload.error === 'string'
                ? body.payload.error
                : JSON.stringify(body.payload.error ?? 'Unknown Error');

            await tx.taskRun.update({
              where: { id: taskRunModel.id },
              data: {
                status: 'FAILED',
                error: errorMsg,
                completedAt: occurredAt,
              },
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
            this.logger.log(
              `Task transitioning to SKIPPED (workflowRunId=${body.payload.workflowRunId}, taskRunId=${body.payload.taskRunId}, correlationId=${body.payload.correlationId})`,
            );
            // Cancellation is treated as a skip from WOE's perspective
            await tx.taskRun.update({
              where: { id: taskRunModel.id },
              data: {
                status: 'SKIPPED',
                completedAt: occurredAt,
              },
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
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.warn(
          `Event ${body.eventId} already processed (P2002). Ignoring duplicate.`,
        );
        return;
      }
      throw e;
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private verifySignature(
    signature: string,
    rawBody: Buffer | undefined,
  ): boolean {
    if (!signature || !rawBody) return false;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }
}
