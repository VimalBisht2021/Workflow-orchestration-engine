import { WebhookController } from './webhook.controller';
import { TaskRun } from '../entities/task-run.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { TaskRunStatus, WorkflowRunStatus } from '@prisma/client';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { WebhookEventDto } from '../dto/webhook-event.dto';

const WEBHOOK_SECRET = 'test-secret';

function makeSignature(body: unknown): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
}

function makeEvent(
  overrides: Partial<WebhookEventDto> & {
    payload?: Partial<WebhookEventDto['payload']>;
  } = {},
): WebhookEventDto {
  const base: WebhookEventDto = {
    eventId: overrides.eventId ?? `evt-${crypto.randomUUID()}`,
    specVersion: overrides.specVersion ?? '1.0',
    eventType: overrides.eventType ?? 'TASK_COMPLETED',
    occurredAt: overrides.occurredAt ?? new Date().toISOString(),
    payload: {
      taskRunId: 'tr-1',
      workflowRunId: 'wr-1',
      workflowVersion: 1,
      correlationId: 'corr-wr-1',
      ...overrides.payload,
    },
  };
  return base;
}

function makeTaskRun(overrides: Partial<TaskRun> = {}): TaskRun {
  return new TaskRun(
    overrides.id ?? 'tr-1',
    overrides.workflowRunId ?? 'wr-1',
    'td-1',
    overrides.status ?? TaskRunStatus.RUNNING,
    null,
    null,
    null,
    null,
    new Date(),
    null,
    new Date(),
    new Date(),
  );
}

function makeWorkflowRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return new WorkflowRun(
    overrides.id ?? 'wr-1',
    'wf-1',
    overrides.workflowVersion ?? 1,
    overrides.status ?? WorkflowRunStatus.RUNNING,
    null,
    new Date(),
    null,
    new Date(),
    new Date(),
  );
}

describe('WebhookController', () => {
  let controller: WebhookController;
  let mockTaskRunRepo: any;
  let mockWorkflowRunRepo: any;
  let mockEventPublisher: any;
  let mockPrisma: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockTaskRunRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    mockWorkflowRunRepo = {
      findById: jest.fn(),
    };
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    mockPrisma = {
      processedWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue(WEBHOOK_SECRET),
    };

    controller = new WebhookController(
      mockTaskRunRepo,
      mockWorkflowRunRepo,
      mockEventPublisher,
      mockPrisma,
      mockConfigService,
    );
  });

  describe('Signature Validation', () => {
    it('should reject missing signature', async () => {
      const body = makeEvent();
      await expect(controller.handleEvent('', body)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject invalid signature', async () => {
      const body = makeEvent();
      await expect(
        controller.handleEvent(
          'invalid-hex-signature-value-000000000000000000000000000000000000000000000000000000000000000',
          body,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Event Idempotency', () => {
    it('should ignore duplicate eventId', async () => {
      const body = makeEvent({ eventId: 'evt-duplicate' });
      const signature = makeSignature(body);

      // Simulate already processed
      mockPrisma.processedWebhookEvent.findUnique.mockResolvedValue({
        eventId: 'evt-duplicate',
      });

      await controller.handleEvent(signature, body);

      // Should NOT have called taskRunRepository
      expect(mockTaskRunRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate Callback', () => {
    it('should ignore TASK_COMPLETED if task is already terminal', async () => {
      const body = makeEvent({ eventType: 'TASK_COMPLETED' });
      const signature = makeSignature(body);

      // Task is already COMPLETED
      mockTaskRunRepo.findById.mockResolvedValue(
        makeTaskRun({ status: TaskRunStatus.COMPLETED }),
      );
      mockWorkflowRunRepo.findById.mockResolvedValue(makeWorkflowRun());

      await controller.handleEvent(signature, body);

      // Should NOT have called update
      expect(mockTaskRunRepo.update).not.toHaveBeenCalled();
      // Should still mark event as processed
      expect(mockPrisma.processedWebhookEvent.create).toHaveBeenCalled();
    });
  });

  describe('Invalid Version', () => {
    it('should reject callback with mismatched workflowVersion', async () => {
      const body = makeEvent({
        payload: { workflowVersion: 99 } as any,
      });
      const signature = makeSignature(body);

      mockTaskRunRepo.findById.mockResolvedValue(makeTaskRun());
      mockWorkflowRunRepo.findById.mockResolvedValue(
        makeWorkflowRun({ workflowVersion: 1 }),
      );

      await expect(controller.handleEvent(signature, body)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Unknown TaskRun', () => {
    it('should reject callback for non-existent taskRunId', async () => {
      const body = makeEvent({
        payload: { taskRunId: 'tr-unknown' } as any,
      });
      const signature = makeSignature(body);

      mockTaskRunRepo.findById.mockResolvedValue(null);

      await expect(controller.handleEvent(signature, body)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Successful Event Processing', () => {
    it('should process TASK_COMPLETED and emit domain event', async () => {
      const body = makeEvent({
        eventType: 'TASK_COMPLETED',
        payload: { output: { result: 'ok' } } as any,
      });
      const signature = makeSignature(body);

      mockTaskRunRepo.findById.mockResolvedValue(makeTaskRun());
      mockWorkflowRunRepo.findById.mockResolvedValue(makeWorkflowRun());

      await controller.handleEvent(signature, body);

      expect(mockTaskRunRepo.update).toHaveBeenCalledWith(
        'tr-1',
        expect.objectContaining({
          status: TaskRunStatus.COMPLETED,
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalled();
      expect(mockPrisma.processedWebhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventId: body.eventId }),
      });
    });

    it('should process TASK_FAILED and emit domain event', async () => {
      const body = makeEvent({
        eventType: 'TASK_FAILED',
        payload: { error: 'timeout' } as any,
      });
      const signature = makeSignature(body);

      mockTaskRunRepo.findById.mockResolvedValue(makeTaskRun());
      mockWorkflowRunRepo.findById.mockResolvedValue(makeWorkflowRun());

      await controller.handleEvent(signature, body);

      expect(mockTaskRunRepo.update).toHaveBeenCalledWith(
        'tr-1',
        expect.objectContaining({
          status: TaskRunStatus.FAILED,
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should process TASK_STARTED and transition to RUNNING', async () => {
      const body = makeEvent({ eventType: 'TASK_STARTED' });
      const signature = makeSignature(body);

      mockTaskRunRepo.findById.mockResolvedValue(
        makeTaskRun({ status: TaskRunStatus.SCHEDULED }),
      );
      mockWorkflowRunRepo.findById.mockResolvedValue(makeWorkflowRun());

      await controller.handleEvent(signature, body);

      expect(mockTaskRunRepo.update).toHaveBeenCalledWith(
        'tr-1',
        expect.objectContaining({
          status: TaskRunStatus.RUNNING,
        }),
      );
    });
  });
});
