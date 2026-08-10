import { WebhookController } from './webhook.controller';
import { TaskRunStatus, WorkflowRunStatus, Prisma } from '@prisma/client';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { WebhookEventDto } from '../dto/webhook-event.dto';

const WEBHOOK_SECRET = 'test-secret';

function makeSignature(rawBody: Buffer): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
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

function makeTaskRunModel(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 'tr-1',
    workflowRunId: overrides.workflowRunId ?? 'wr-1',
    status: overrides.status ?? TaskRunStatus.RUNNING,
  };
}

function makeWorkflowRunModel(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 'wr-1',
    workflowVersion: overrides.workflowVersion ?? 1,
    status: overrides.status ?? WorkflowRunStatus.RUNNING,
  };
}

describe('WebhookController', () => {
  let controller: WebhookController;
  let mockTaskRunRepo: any;
  let mockWorkflowRunRepo: any;
  let mockEventPublisher: any;
  let mockPrisma: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockTaskRunRepo = {};
    mockWorkflowRunRepo = {};
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      processedWebhookEvent: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      taskRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      workflowRun: {
        findUnique: jest.fn(),
      },
    };
    mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue(WEBHOOK_SECRET),
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
      const rawBody = Buffer.from(JSON.stringify(body));
      await expect(
        controller.handleEvent('', { rawBody } as any, body),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject invalid signature', async () => {
      const body = makeEvent();
      const rawBody = Buffer.from(JSON.stringify(body));
      await expect(
        controller.handleEvent(
          'invalid-hex-signature-value-000000000000000000000000000000000000000000000000000000000000000',
          { rawBody } as any,
          body,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Event Idempotency', () => {
    it('should ignore duplicate eventId (P2002 error)', async () => {
      const body = makeEvent({ eventId: 'evt-duplicate' });
      const rawBody = Buffer.from(JSON.stringify(body));
      const signature = makeSignature(rawBody);

      // Simulate P2002 Prisma duplicate insert error
      mockPrisma.processedWebhookEvent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );

      await controller.handleEvent(signature, { rawBody } as any, body);

      // Should NOT have called taskRun.findUnique
      expect(mockPrisma.taskRun.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate Callback', () => {
    it('should ignore TASK_COMPLETED if task is already terminal', async () => {
      const body = makeEvent({ eventType: 'TASK_COMPLETED' });
      const rawBody = Buffer.from(JSON.stringify(body));
      const signature = makeSignature(rawBody);

      mockPrisma.taskRun.findUnique.mockResolvedValue(
        makeTaskRunModel({ status: TaskRunStatus.COMPLETED }),
      );
      mockPrisma.workflowRun.findUnique.mockResolvedValue(
        makeWorkflowRunModel(),
      );

      await controller.handleEvent(signature, { rawBody } as any, body);

      // Should NOT have called update
      expect(mockPrisma.taskRun.update).not.toHaveBeenCalled();
      // Should have inserted the processed event
      expect(mockPrisma.processedWebhookEvent.create).toHaveBeenCalled();
    });
  });

  describe('Invalid Version', () => {
    it('should reject callback with mismatched workflowVersion', async () => {
      const body = makeEvent({
        payload: { workflowVersion: 99 } as any,
      });
      const rawBody = Buffer.from(JSON.stringify(body));
      const signature = makeSignature(rawBody);

      mockPrisma.taskRun.findUnique.mockResolvedValue(makeTaskRunModel());
      mockPrisma.workflowRun.findUnique.mockResolvedValue(
        makeWorkflowRunModel({ workflowVersion: 1 }),
      );

      await expect(
        controller.handleEvent(signature, { rawBody } as any, body),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Unknown TaskRun', () => {
    it('should reject callback for non-existent taskRunId', async () => {
      const body = makeEvent({
        payload: { taskRunId: 'tr-unknown' } as any,
      });
      const rawBody = Buffer.from(JSON.stringify(body));
      const signature = makeSignature(rawBody);

      mockPrisma.taskRun.findUnique.mockResolvedValue(null);

      await expect(
        controller.handleEvent(signature, { rawBody } as any, body),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Successful Event Processing', () => {
    it('should process TASK_COMPLETED and emit domain event', async () => {
      const body = makeEvent({
        eventType: 'TASK_COMPLETED',
        payload: { output: { result: 'ok' } } as any,
      });
      const rawBody = Buffer.from(JSON.stringify(body));
      const signature = makeSignature(rawBody);

      mockPrisma.taskRun.findUnique.mockResolvedValue(makeTaskRunModel());
      mockPrisma.workflowRun.findUnique.mockResolvedValue(
        makeWorkflowRunModel(),
      );

      await controller.handleEvent(signature, { rawBody } as any, body);

      expect(mockPrisma.taskRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tr-1' },
          data: expect.objectContaining({
            status: TaskRunStatus.COMPLETED,
          }),
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
      const rawBody = Buffer.from(JSON.stringify(body));
      const signature = makeSignature(rawBody);

      mockPrisma.taskRun.findUnique.mockResolvedValue(makeTaskRunModel());
      mockPrisma.workflowRun.findUnique.mockResolvedValue(
        makeWorkflowRunModel(),
      );

      await controller.handleEvent(signature, { rawBody } as any, body);

      expect(mockPrisma.taskRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tr-1' },
          data: expect.objectContaining({
            status: TaskRunStatus.FAILED,
          }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should process TASK_STARTED and transition to RUNNING', async () => {
      const body = makeEvent({ eventType: 'TASK_STARTED' });
      const rawBody = Buffer.from(JSON.stringify(body));
      const signature = makeSignature(rawBody);

      mockPrisma.taskRun.findUnique.mockResolvedValue(
        makeTaskRunModel({ status: TaskRunStatus.SCHEDULED }),
      );
      mockPrisma.workflowRun.findUnique.mockResolvedValue(
        makeWorkflowRunModel(),
      );

      await controller.handleEvent(signature, { rawBody } as any, body);

      expect(mockPrisma.taskRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tr-1' },
          data: expect.objectContaining({
            status: TaskRunStatus.RUNNING,
          }),
        }),
      );
    });
  });
});
