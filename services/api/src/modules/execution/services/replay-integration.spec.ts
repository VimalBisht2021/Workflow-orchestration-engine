import { ExecutionEngine } from './execution-engine.service';
import { ReplayService } from './replay.service';
import { WebhookController } from '../controllers/webhook.controller';
import { WorkflowRunFactory } from './workflow-run.factory';
import { DependencyResolver } from './dependency-resolver.service';
import { HandlerRegistry } from '../handlers/handler.registry';
import { FailFastStrategy } from './fail-fast.strategy';
import { TaskRun } from '../entities/task-run.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { Workflow } from '../../workflow/entities/workflow.entity';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import {
  BackoffStrategy,
  WorkflowRunStatus,
  TaskRunStatus,
} from '@prisma/client';
import { WorkflowStatus } from '../../workflow/enums/workflow-status.enum';
import { DomainEventPublisher } from '../events/domain/domain-event-publisher.interface';
import {
  DomainEvent,
  WorkflowStartedDomainEvent,
  TaskCompletedDomainEvent,
  TaskFailedDomainEvent,
} from '../events/domain/domain-events';
import type { TaskExecutionGateway } from '../dispatchers/task-execution-gateway.interface';
import type { DispatchRequest } from '@local/execution-contract';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

class MockWorkflowRepository {
  private workflow: Workflow;
  setWorkflow(wf: Workflow) {
    this.workflow = wf;
  }
  async findById(id: string) {
    return this.workflow;
  }
}

class MockWorkflowRunRepository {
  public runs = new Map<string, WorkflowRun>();
  constructor(private taskRunRepo: MockTaskRunRepository) {}

  async create(run: WorkflowRun) {
    this.runs.set(run.id, run);
    return run;
  }
  async findById(id: string) {
    const run = this.runs.get(id);
    if (!run) return null;
    const clone = Object.assign(Object.create(Object.getPrototypeOf(run)), run);
    clone.taskRuns = clone.taskRuns.map((tr: any) => {
      const latestTr = this.taskRunRepo.runs.get(tr.id);
      return latestTr
        ? Object.assign(
            Object.create(Object.getPrototypeOf(latestTr)),
            latestTr,
          )
        : tr;
    });
    return clone;
  }
  async update(id: string, partial: any) {
    const run = this.runs.get(id);
    if (run) Object.assign(run, partial);
    return run!;
  }
}

class MockTaskRunRepository {
  public runs = new Map<string, TaskRun>();
  async create(run: TaskRun) {
    this.runs.set(run.id, run);
    return run;
  }
  async findById(id: string) {
    const run = this.runs.get(id);
    return run
      ? Object.assign(Object.create(Object.getPrototypeOf(run)), run)
      : null;
  }
  async atomicUpdateStatus(id: string, fromStatus: string, toStatus: string) {
    const run = this.runs.get(id);
    if (run && run.status === fromStatus) {
      run.status = toStatus as TaskRunStatus;
      return true;
    }
    return false;
  }
  async update(id: string, partial: any) {
    const run = this.runs.get(id);
    if (run) Object.assign(run, partial);
    return run!;
  }
}

class RecordingGateway implements TaskExecutionGateway {
  public dispatches: DispatchRequest[] = [];
  async dispatch(request: DispatchRequest): Promise<void> {
    this.dispatches.push(request);
  }
}

const stubObservability = {
  startSpan: () => ({ setAttribute: () => {}, end: () => {}, spanContext: () => ({ traceId: 'test-trace-id' }) }),
  recordWorkflowStart: () => {},
  recordWorkflowCompletion: () => {},
  recordWorkflowFailure: () => {},
  recordException: () => {},
};

describe('Integration: Replay After Callback', () => {
  let engine: ExecutionEngine;
  let replayService: ReplayService;
  let webhookController: WebhookController;
  let gateway: RecordingGateway;
  let workflowRunRepo: MockWorkflowRunRepository;
  let taskRunRepo: MockTaskRunRepository;

  const WEBHOOK_SECRET = 'test-secret';
  const makeSignature = (body: any) =>
    crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
  const makeReq = (body: any) => ({ rawBody: Buffer.from(JSON.stringify(body)) } as any);

  beforeEach(() => {
    const workflowRepo = new MockWorkflowRepository();
    taskRunRepo = new MockTaskRunRepository();
    workflowRunRepo = new MockWorkflowRunRepository(taskRunRepo);
    gateway = new RecordingGateway();

    const factory = new WorkflowRunFactory();
    const handlerRegistry = new HandlerRegistry();
    handlerRegistry.register({
      getName: () => 'handler-a',
      execute: async () => ({}),
    });
    handlerRegistry.register({
      getName: () => 'handler-b',
      execute: async () => ({}),
    });

    let engineRef: any = null;
    const fakePublisher: DomainEventPublisher = {
      publish: async (event: DomainEvent) => {
        if (!engineRef) return;
        if (event instanceof WorkflowStartedDomainEvent)
          await engineRef.handleWorkflowStarted(event);
        else if (event instanceof TaskCompletedDomainEvent)
          await engineRef.handleTaskCompleted(event);
        else if (event instanceof TaskFailedDomainEvent)
          await engineRef.handleTaskFailed(event);
      },
    };

    engine = new ExecutionEngine(
      workflowRepo as any,
      workflowRunRepo as any,
      taskRunRepo as any,
      factory,
      new DependencyResolver(),
      handlerRegistry,
      gateway,
      new FailFastStrategy(workflowRunRepo as any),
      fakePublisher,
      stubObservability as any,
    );
    engineRef = engine;

    replayService = new ReplayService(
      workflowRunRepo as any,
      taskRunRepo as any,
      workflowRepo as any,
      factory,
      fakePublisher,
    );

    const mockPrisma = {
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      taskRun: {
        findUnique: jest.fn(async ({ where }) => taskRunRepo.findById(where.id)),
        update: jest.fn(async ({ where, data }) => taskRunRepo.update(where.id, data)),
      },
      workflowRun: {
        findUnique: jest.fn(async ({ where }) => workflowRunRepo.findById(where.id)),
      },
      processedWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const mockConfigService = { 
      get: () => WEBHOOK_SECRET,
      getOrThrow: () => WEBHOOK_SECRET,
    };

    webhookController = new WebhookController(
      taskRunRepo as any,
      workflowRunRepo as any,
      fakePublisher,
      mockPrisma as any,
      mockConfigService as any,
    );

    const workflow = new Workflow(
      'wf-1',
      'ReplayTest',
      undefined,
      'owner',
      [],
      1,
      WorkflowStatus.PUBLISHED,
      new Date(),
    );
    workflow.tasks = [
      new TaskDefinition(
        'A',
        'Task A',
        'handler-a',
        [],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
      new TaskDefinition(
        'B',
        'Task B',
        'handler-b',
        ['A'],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
    ];
    workflowRepo.setWorkflow(workflow);
  });

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  it('webhook -> fail -> replay -> redispatch', async () => {
    // 1. Start Workflow
    const originalRun = await engine.startWorkflow('wf-1');
    await delay(50); // let reconciliation finish

    // Verify Task A was dispatched
    expect(gateway.dispatches.length).toBe(1);
    const firstDispatch = gateway.dispatches[0];
    expect(firstDispatch.handler).toBe('handler-a');
    expect(firstDispatch.workflowRunId).toBe(originalRun.id);

    // 2. Simulate Webhook Callback (Task A Started)
    const startedEvent = {
      eventId: 'evt-0',
      specVersion: '1.0',
      eventType: 'TASK_STARTED' as any,
      occurredAt: new Date().toISOString(),
      payload: {
        taskRunId: firstDispatch.taskRunId,
        workflowRunId: originalRun.id,
        workflowVersion: 1,
        correlationId: firstDispatch.correlationId,
      },
    };
    await webhookController.handleEvent(
      makeSignature(startedEvent),
      makeReq(startedEvent),
      startedEvent,
    );
    await delay(20);

    // 2b. Simulate Webhook Callback (Task A Fails)
    const failEvent = {
      eventId: 'evt-1',
      specVersion: '1.0',
      eventType: 'TASK_FAILED' as any,
      occurredAt: new Date().toISOString(),
      payload: {
        taskRunId: firstDispatch.taskRunId,
        workflowRunId: originalRun.id,
        workflowVersion: 1,
        correlationId: firstDispatch.correlationId,
        error: 'Simulated DTP failure',
      },
    };
    await webhookController.handleEvent(
      makeSignature(failEvent), 
      makeReq(failEvent),
      failEvent
    );
    await delay(50);

    // Verify original run is now FAILED
    const failedRun = await workflowRunRepo.findById(originalRun.id);
    expect(failedRun!.status).toBe(WorkflowRunStatus.FAILED);
    expect(
      failedRun!.taskRuns.find((t) => t.taskDefinitionId === 'A')!.status,
    ).toBe(TaskRunStatus.FAILED);

    // Clear gateway dispatches for the next phase
    gateway.dispatches = [];

    // 3. Replay
    const replayedRun = await replayService.replayWorkflow(failedRun!.id);
    await delay(50);

    // Verify replay semantics
    expect(replayedRun.replayedFromId).toBe(failedRun!.id);

    // Verify Task A was redispatched on the new run
    expect(gateway.dispatches.length).toBe(1);
    const replayDispatch = gateway.dispatches[0];
    expect(replayDispatch.handler).toBe('handler-a');
    expect(replayDispatch.workflowRunId).toBe(replayedRun.id);
    expect(replayDispatch.workflowRunId).not.toBe(originalRun.id);

    // Verify original run is unchanged
    const untouchedOriginal = await workflowRunRepo.findById(originalRun.id);
    expect(untouchedOriginal!.status).toBe(WorkflowRunStatus.FAILED);
  });
});
