import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { ExecutionEngine } from '../src/modules/execution/services/execution-engine.service';
import { TASK_EXECUTION_GATEWAY } from '../src/modules/execution/dispatchers/task-execution-gateway.interface';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('Execution Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let executionEngine: ExecutionEngine;
  let configService: ConfigService;
  let mockTaskGateway: any;

  beforeAll(async () => {
    mockTaskGateway = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TASK_EXECUTION_GATEWAY)
      .useValue(mockTaskGateway)
      .compile();

    // Enable rawBody just like main.ts
    app = moduleFixture.createNestApplication({ rawBody: true });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
    executionEngine = app.get(ExecutionEngine);
    configService = app.get(ConfigService);
  });

  afterAll(async () => {
    await prisma.taskRun.deleteMany();
    await prisma.workflowRun.deleteMany();
    await prisma.processedWebhookEvent.deleteMany();
    await app.close();
  });

  it('should run a workflow end-to-end (internal execution flow)', async () => {
    // 1. Setup a test workflow
    const workflowId = `test-wf-${crypto.randomUUID()}`;
    await prisma.workflow.create({
      data: {
        id: workflowId,
        name: 'Test Workflow',
        owner: 'e2e-test',
        status: 'PUBLISHED',
        version: 1,
        taskDefinitions: {
          create: [
            {
              id: 'task-1',
              name: 'Task 1',
              handler: 'test-handler',
              dependencies: [],
              maxRetries: 0,
              retryDelayMs: 1000,
              timeoutMs: 30000,
            },
          ],
        },
      },
    });

    // 2. Start the workflow
    const workflowRun = await executionEngine.startWorkflow(workflowId);

    // Allow event loop to process domain events
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Verify dispatch was called
    expect(mockTaskGateway.dispatch).toHaveBeenCalled();
    const dispatchRequest = mockTaskGateway.dispatch.mock.calls[0][0];

    expect(dispatchRequest.workflowRunId).toBe(workflowRun.id);
    expect(dispatchRequest.handler).toBe('test-handler');

    // 4. Simulate DTP Webhook (TASK_COMPLETED)
    const secret = configService.getOrThrow<string>('WEBHOOK_SECRET');
    const webhookPayload = {
      eventId: `evt-${crypto.randomUUID()}`,
      specVersion: '1.0',
      eventType: 'TASK_COMPLETED',
      occurredAt: new Date().toISOString(),
      payload: {
        taskRunId: dispatchRequest.taskRunId,
        workflowRunId: dispatchRequest.workflowRunId,
        workflowVersion: dispatchRequest.workflowVersion,
        correlationId: dispatchRequest.correlationId,
        output: { result: 'success' },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(webhookPayload));
    const signature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    await request(app.getHttpServer())
      .post('/api/webhooks/tasks/events')
      .set('x-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(202);

    // Allow event loop for completion events
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 5. Verify task and workflow run completed
    const taskRun = await prisma.taskRun.findUnique({
      where: { id: dispatchRequest.taskRunId },
    });
    expect(taskRun?.status).toBe('COMPLETED');

    const wfRun = await prisma.workflowRun.findUnique({
      where: { id: workflowRun.id },
    });
    expect(wfRun?.status).toBe('COMPLETED');

    // 6. Idempotency test - duplicate webhook should return 202 but not error out
    await request(app.getHttpServer())
      .post('/api/webhooks/tasks/events')
      .set('x-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(202);
  });
});
