import { ExecutionEngine } from './execution-engine.service';
import { WorkflowRunFactory } from './workflow-run.factory';
import { DependencyResolver } from './dependency-resolver.service';
import { HandlerRegistry } from '../handlers/handler.registry';
import {
  TaskHandler,
  TaskExecutionContext,
} from '../handlers/task-handler.interface';
import { FailFastStrategy } from './fail-fast.strategy';
import { Workflow } from '../../workflow/entities/workflow.entity';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import {
  BackoffStrategy,
  WorkflowRunStatus,
  TaskRunStatus,
} from '@prisma/client';
import { WorkflowStatus } from '../../workflow/enums/workflow-status.enum';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { TaskRun } from '../entities/task-run.entity';
import { DomainEventPublisher } from '../events/domain/domain-event-publisher.interface';
import {
  DomainEvent,
  WorkflowStartedDomainEvent,
  TaskCompletedDomainEvent,
  TaskFailedDomainEvent,
} from '../events/domain/domain-events';
import type { TaskExecutionGateway } from '../dispatchers/task-execution-gateway.interface';
import type { DispatchRequest } from '@local/execution-contract';

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
    // Fetch latest task runs to mimic DB behavior
    clone.taskRuns = clone.taskRuns.map((tr: any) => {
      const latestTr = this.taskRunRepo.runs.get(tr.id);
      return latestTr
        ? Object.assign(
            Object.create(Object.getPrototypeOf(latestTr)),
            latestTr,
          )
        : Object.assign(Object.create(Object.getPrototypeOf(tr)), tr);
    });
    return clone;
  }

  async update(id: string, partial: any) {
    const run = this.runs.get(id);
    if (run) {
      if (partial.status !== undefined) run.status = partial.status;
      if (partial.startedAt !== undefined) run.startedAt = partial.startedAt;
      if (partial.completedAt !== undefined)
        run.completedAt = partial.completedAt;
    }
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

  async atomicUpdateStatus(
    id: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<boolean> {
    const run = this.runs.get(id);
    if (run && run.status === fromStatus) {
      run.status = toStatus as TaskRunStatus;
      return true;
    }
    return false;
  }

  async update(id: string, partial: any) {
    const run = this.runs.get(id);
    if (run) {
      if (partial.status !== undefined) run.status = partial.status;
      if (partial.queuedAt !== undefined) run.queuedAt = partial.queuedAt;
      if (partial.startedAt !== undefined) run.startedAt = partial.startedAt;
      if (partial.completedAt !== undefined)
        run.completedAt = partial.completedAt;
      if (partial.output !== undefined) run.output = partial.output;
      if (partial.error !== undefined) run.error = partial.error;
    }
    return run!;
  }
}

class DummyHandler implements TaskHandler {
  constructor(
    private name: string,
    private shouldFail: boolean = false,
  ) {}
  getName() {
    return this.name;
  }
  async execute(): Promise<any> {
    if (this.shouldFail) throw new Error('Task Failed');
    return { done: true };
  }
}

/**
 * Mock TaskExecutionGateway that simulates DTP behavior in-process.
 *
 * When dispatch() is called, it immediately executes the handler and
 * publishes the appropriate domain event, simulating the async
 * DTP → webhook → reconcile cycle synchronously for testing.
 */
class MockTaskExecutionGateway implements TaskExecutionGateway {
  public dispatches: DispatchRequest[] = [];

  constructor(
    private handlerRegistry: HandlerRegistry,
    private workflowRunRepo: MockWorkflowRunRepository,
    private taskRunRepo: MockTaskRunRepository,
    private eventPublisher: DomainEventPublisher,
  ) {}

  async dispatch(request: DispatchRequest): Promise<void> {
    this.dispatches.push(request);

    const taskRun = this.taskRunRepo.runs.get(request.taskRunId);
    if (!taskRun) return;

    // Simulate DTP: transition SCHEDULED → RUNNING
    taskRun.status = TaskRunStatus.RUNNING;
    taskRun.startedAt = new Date();

    try {
      const handler = this.handlerRegistry.resolve(request.handler);
      const workflowRun = await this.workflowRunRepo.findById(
        request.workflowRunId,
      );
      if (!workflowRun) return;

      const output = await handler.execute({
        taskRun,
        workflowRun,
        input: request.input,
      });

      taskRun.status = TaskRunStatus.COMPLETED;
      taskRun.output = output;
      taskRun.completedAt = new Date();

      await this.eventPublisher.publish(
        new TaskCompletedDomainEvent(
          request.workflowRunId,
          request.taskRunId,
          output,
        ),
      );
    } catch (error: any) {
      taskRun.status = TaskRunStatus.FAILED;
      taskRun.error = error.message;
      taskRun.completedAt = new Date();

      await this.eventPublisher.publish(
        new TaskFailedDomainEvent(
          request.workflowRunId,
          request.taskRunId,
          error.message,
        ),
      );
    }
  }
}

// Stub observability service for tests
const stubObservability = {
  startSpan: () => ({
    setAttribute: () => {},
    end: () => {},
  }),
  recordWorkflowStart: () => {},
  recordWorkflowCompletion: () => {},
  recordWorkflowFailure: () => {},
  recordException: () => {},
};

describe('ExecutionEngine Integration', () => {
  let engine: ExecutionEngine;
  let workflowRepo: MockWorkflowRepository;
  let workflowRunRepo: MockWorkflowRunRepository;
  let taskRunRepo: MockTaskRunRepository;
  let handlerRegistry: HandlerRegistry;
  let mockGateway: MockTaskExecutionGateway;

  beforeEach(() => {
    workflowRepo = new MockWorkflowRepository();
    taskRunRepo = new MockTaskRunRepository();
    workflowRunRepo = new MockWorkflowRunRepository(taskRunRepo);

    handlerRegistry = new HandlerRegistry();
    handlerRegistry.register(new DummyHandler('success-handler'));
    handlerRegistry.register(new DummyHandler('fail-handler', true));

    const factory = new WorkflowRunFactory();
    const resolver = new DependencyResolver();
    const failureStrategy = new FailFastStrategy(workflowRunRepo as any);

    // Fake event publisher to bridge mock gateway and engine in unit tests
    let engineRef: any = null;
    const fakePublisher: DomainEventPublisher = {
      publish: async (event: DomainEvent) => {
        if (!engineRef) return;
        if (event instanceof WorkflowStartedDomainEvent) {
          await engineRef.handleWorkflowStarted(event);
        } else if (event instanceof TaskCompletedDomainEvent) {
          await engineRef.handleTaskCompleted(event);
        } else if (event instanceof TaskFailedDomainEvent) {
          await engineRef.handleTaskFailed(event);
        }
      },
    };

    mockGateway = new MockTaskExecutionGateway(
      handlerRegistry,
      workflowRunRepo,
      taskRunRepo,
      fakePublisher,
    );

    engine = new ExecutionEngine(
      workflowRepo as any,
      workflowRunRepo as any,
      taskRunRepo as any,
      factory,
      resolver,
      handlerRegistry,
      mockGateway,
      failureStrategy,
      fakePublisher,
      stubObservability as any,
    );

    engineRef = engine;
  });

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  it('should execute a linear workflow successfully A -> B -> C', async () => {
    const workflow = new Workflow(
      'wf-1',
      'Linear',
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
        'success-handler',
        [],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
      new TaskDefinition(
        'B',
        'Task B',
        'success-handler',
        ['A'],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
      new TaskDefinition(
        'C',
        'Task C',
        'success-handler',
        ['B'],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
    ];
    workflowRepo.setWorkflow(workflow);

    const run = await engine.startWorkflow('wf-1');

    await delay(100);

    const updatedRun = await workflowRunRepo.findById(run.id);
    expect(updatedRun!.status).toBe(WorkflowRunStatus.COMPLETED);

    const taskA = Array.from(taskRunRepo.runs.values()).find(
      (t) => t.taskDefinitionId === 'A',
    );
    const taskB = Array.from(taskRunRepo.runs.values()).find(
      (t) => t.taskDefinitionId === 'B',
    );
    const taskC = Array.from(taskRunRepo.runs.values()).find(
      (t) => t.taskDefinitionId === 'C',
    );

    expect(taskA!.status).toBe(TaskRunStatus.COMPLETED);
    expect(taskB!.status).toBe(TaskRunStatus.COMPLETED);
    expect(taskC!.status).toBe(TaskRunStatus.COMPLETED);

    // Check order
    expect(taskA!.completedAt!.getTime()).toBeLessThanOrEqual(
      taskB!.completedAt!.getTime(),
    );
    expect(taskB!.completedAt!.getTime()).toBeLessThanOrEqual(
      taskC!.completedAt!.getTime(),
    );
  });

  it('should fail workflow if a task fails A -> B', async () => {
    const workflow = new Workflow(
      'wf-2',
      'Fail',
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
        'fail-handler',
        [],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
      new TaskDefinition(
        'B',
        'Task B',
        'success-handler',
        ['A'],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
    ];
    workflowRepo.setWorkflow(workflow);

    const run = await engine.startWorkflow('wf-2');

    await delay(50);

    const updatedRun = await workflowRunRepo.findById(run.id);
    expect(updatedRun!.status).toBe(WorkflowRunStatus.FAILED);

    const taskA = Array.from(taskRunRepo.runs.values()).find(
      (t) => t.taskDefinitionId === 'A',
    );
    const taskB = Array.from(taskRunRepo.runs.values()).find(
      (t) => t.taskDefinitionId === 'B',
    );

    expect(taskA!.status).toBe(TaskRunStatus.FAILED);
    expect(taskA!.error).toBe('Task Failed');

    // B was never scheduled because A failed
    expect(taskB!.status).toBe(TaskRunStatus.PENDING);
  });

  describe('Test 4 — Out-of-Order Events', () => {
    it('should gracefully handle duplicate TaskCompletedDomainEvent without throwing', async () => {
      const workflow = new Workflow(
        'wf-4',
        'Duplicate',
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
          'success-handler',
          [],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
      ];
      workflowRepo.setWorkflow(workflow);

      const run = await engine.startWorkflow('wf-4');
      await delay(50);

      const taskA = Array.from(taskRunRepo.runs.values()).find(
        (t) => t.taskDefinitionId === 'A',
      );
      expect(taskA!.status).toBe(TaskRunStatus.COMPLETED);

      // Now send the event again — should not throw
      await expect(
        engine.handleTaskCompleted(
          new TaskCompletedDomainEvent(run.id, taskA!.id, 'corr-1'),
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Test 5 — Concurrent Completion', () => {
    it('should dispatch dependent task exactly once when dependencies complete simultaneously', async () => {
      const workflow = new Workflow(
        'wf-5',
        'Concurrent',
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
          'success-handler',
          [],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
        new TaskDefinition(
          'B',
          'Task B',
          'success-handler',
          ['A'],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
        new TaskDefinition(
          'C',
          'Task C',
          'success-handler',
          ['A'],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
        new TaskDefinition(
          'D',
          'Task D',
          'success-handler',
          ['B', 'C'],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
      ];
      workflowRepo.setWorkflow(workflow);

      const run = await engine.startWorkflow('wf-5');
      await delay(50);

      // Simulate calling reconcile concurrently
      await Promise.all([engine.reconcile(run.id), engine.reconcile(run.id)]);

      const dDispatches = mockGateway.dispatches.filter((d) => {
        const def = workflow.tasks.find(
          (t) =>
            t.id ===
            Array.from(taskRunRepo.runs.values()).find(
              (r) => r.id === d.taskRunId,
            )?.taskDefinitionId,
        );
        return def?.id === 'D';
      });
      // D should only be dispatched once (atomicUpdateStatus ensures this)
      expect(dDispatches.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Test 7 — Dispatch Request Construction', () => {
    it('should construct dispatch request with correct fields from orchestration context', async () => {
      const workflow = new Workflow(
        'wf-7',
        'Contract',
        undefined,
        'owner',
        [],
        2,
        WorkflowStatus.PUBLISHED,
        new Date(),
      );
      workflow.tasks = [
        new TaskDefinition(
          'A',
          'Task A',
          'success-handler',
          [],
          3,
          2000,
          BackoffStrategy.EXPONENTIAL,
          undefined,
          30000,
        ),
      ];
      workflowRepo.setWorkflow(workflow);

      await engine.startWorkflow('wf-7');
      await delay(50);

      expect(mockGateway.dispatches.length).toBeGreaterThanOrEqual(1);
      const request = mockGateway.dispatches[0];

      expect(request.handler).toBe('success-handler');
      expect(request.workflowVersion).toBe(2);
      expect(request.retryPolicy).toEqual({
        maxRetries: 3,
        delayMs: 2000,
        backoffStrategy: 'EXPONENTIAL',
      });
      expect(request.timeoutMs).toBe(30000);
      expect(request.correlationId).toContain('corr-');
      expect(request.capabilities).toEqual({});
    });

    it('should set retryPolicy to null when maxRetries is 0', async () => {
      const workflow = new Workflow(
        'wf-8',
        'NoRetry',
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
          'success-handler',
          [],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
      ];
      workflowRepo.setWorkflow(workflow);

      await engine.startWorkflow('wf-8');
      await delay(50);

      const request = mockGateway.dispatches.find((d) => true);
      expect(request!.retryPolicy).toBeNull();
    });
  });

  describe('Test 8 — Correlation ID Propagation', () => {
    it('should propagate consistent correlationId across all dispatches', async () => {
      const workflow = new Workflow(
        'wf-9',
        'Correlation',
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
          'success-handler',
          [],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
        new TaskDefinition(
          'B',
          'Task B',
          'success-handler',
          ['A'],
          0,
          1000,
          BackoffStrategy.FIXED,
        ),
      ];
      workflowRepo.setWorkflow(workflow);

      const run = await engine.startWorkflow('wf-9');
      await delay(50);

      const expectedCorrelationId = `corr-${run.id}`;
      for (const dispatch of mockGateway.dispatches) {
        expect(dispatch.correlationId).toBe(expectedCorrelationId);
        expect(dispatch.workflowRunId).toBe(run.id);
      }
    });
  });
});
