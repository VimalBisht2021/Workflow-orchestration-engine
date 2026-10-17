import { WorkflowRunFactory } from '../services/workflow-run.factory';
import { ReplayService } from '../services/replay.service';
import { ExecutionEngine } from '../services/execution-engine.service';
import { DependencyResolver } from '../services/dependency-resolver.service';
import { HandlerRegistry } from '../handlers/handler.registry';
import { FailFastStrategy } from '../services/fail-fast.strategy';
import { Workflow } from '../../workflow/entities/workflow.entity';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { TaskRun } from '../entities/task-run.entity';
import { WorkflowStatus } from '../../workflow/enums/workflow-status.enum';
import {
  WorkflowRunStatus,
  TaskRunStatus,
  BackoffStrategy,
} from '@prisma/client';
import type { TaskExecutionGateway } from '../dispatchers/task-execution-gateway.interface';
import type { DispatchRequest } from '@local/execution-contract';

class MockWorkflowRepository {
  public workflows = new Map<string, Workflow>();
  async findById(id: string) {
    return this.workflows.get(id) || null;
  }
  async update(id: string, partial: Partial<Workflow>) {
    const existing = this.workflows.get(id);
    if (!existing) throw new Error('Not found');
    const updated = new Workflow(
      existing.id,
      partial.name || existing.name,
      partial.description !== undefined
        ? partial.description
        : existing.description,
      existing.owner,
      existing.tags,
      partial.version || existing.version,
      partial.status || existing.status,
      existing.createdAt,
    );
    if (partial.tasks) {
      updated.tasks = partial.tasks;
    } else {
      updated.tasks = existing.tasks;
    }
    this.workflows.set(id, updated);
    return updated;
  }
}

class MockTaskRunRepository {
  public runs = new Map<string, TaskRun>();
  async create(run: TaskRun) {
    this.runs.set(run.id, run);
    return run;
  }
  async findById(id: string) {
    return this.runs.get(id) || null;
  }
  async update(id: string, partial: any) {
    const run = this.runs.get(id);
    if (run) Object.assign(run, partial);
    return run!;
  }
  async atomicUpdateStatus(id: string, from: TaskRunStatus, to: TaskRunStatus) {
    const run = this.runs.get(id);
    if (!run || run.status !== from) return false;
    run.status = to;
    return true;
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
    return this.runs.get(id) || null;
  }
  async update(id: string, partial: any) {
    const run = this.runs.get(id);
    if (run) Object.assign(run, partial);
    return run!;
  }
}

class MockGateway implements TaskExecutionGateway {
  public dispatches: DispatchRequest[] = [];
  public shouldFailDispatch = false;
  public shouldFailCancel = false;

  async dispatch(req: DispatchRequest) {
    if (this.shouldFailDispatch) {
      throw new Error('DTP dispatch connection refused');
    }
    this.dispatches.push(req);
  }

  async cancel(idempotencyKey: string) {
    if (this.shouldFailCancel) {
      throw new Error('DTP job cannot be cancelled: already in final stages');
    }
  }
}

describe('WOE Audit Regressions (WOE-01, WOE-03, WOE-04, WOE-07)', () => {
  let workflowRepo: MockWorkflowRepository;
  let taskRunRepo: MockTaskRunRepository;
  let workflowRunRepo: MockWorkflowRunRepository;
  let gateway: MockGateway;
  let factory: WorkflowRunFactory;
  let engine: ExecutionEngine;
  let replayService: ReplayService;

  beforeEach(() => {
    workflowRepo = new MockWorkflowRepository();
    taskRunRepo = new MockTaskRunRepository();
    workflowRunRepo = new MockWorkflowRunRepository(taskRunRepo);
    gateway = new MockGateway();
    factory = new WorkflowRunFactory();

    const handlerRegistry = new HandlerRegistry();
    handlerRegistry.register({
      getName: () => 'test-handler',
      execute: async () => ({}),
    });

    const fakePublisher: any = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const stubObs: any = {
      startSpan: () => ({
        setAttribute: () => {},
        end: () => {},
        spanContext: () => ({ traceId: 'trace-1' }),
      }),
      recordWorkflowStart: () => {},
      recordWorkflowCompletion: () => {},
      recordWorkflowFailure: () => {},
      recordException: () => {},
    };

    engine = new ExecutionEngine(
      workflowRepo as any,
      workflowRunRepo as any,
      taskRunRepo as any,
      factory,
      new DependencyResolver(),
      handlerRegistry,
      gateway,
      new FailFastStrategy(workflowRunRepo as any, gateway, taskRunRepo as any),
      fakePublisher,
      stubObs,
    );

    replayService = new ReplayService(
      workflowRunRepo as any,
      taskRunRepo as any,
      workflowRepo as any,
      factory,
      fakePublisher,
    );

    // Seed test workflow
    const wf = new Workflow(
      'wf-100',
      'Test Workflow',
      '',
      'owner',
      [],
      1,
      WorkflowStatus.PUBLISHED,
      new Date(),
    );
    wf.tasks = [
      new TaskDefinition(
        'task-1',
        'Step 1',
        'test-handler',
        [],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
      new TaskDefinition(
        'task-2',
        'Step 2',
        'test-handler',
        ['task-1'],
        0,
        1000,
        BackoffStrategy.FIXED,
      ),
    ];
    workflowRepo.workflows.set('wf-100', wf);
  });

  describe('WOE-01: Dispatch Failure Rollback', () => {
    it('should roll back task status from SCHEDULED to PENDING if dispatch throws', async () => {
      gateway.shouldFailDispatch = true;

      const run = await engine.startWorkflow('wf-100');
      await expect(engine.reconcile(run.id)).rejects.toThrow(
        'DTP dispatch connection refused',
      );

      // task-1 must NOT remain stuck in SCHEDULED
      const task1 = Array.from(taskRunRepo.runs.values()).find(
        (t) => t.taskDefinitionId === 'task-1',
      );
      expect(task1?.status).toBe(TaskRunStatus.PENDING);
    });
  });

  describe('WOE-03: Explicit Cancellation Semantics', () => {
    it('should mark task as CANCELLED and record error details when remote cancel fails', async () => {
      const run = await engine.startWorkflow('wf-100');
      gateway.shouldFailCancel = true;

      await engine.cancelWorkflowRun(run.id);

      const updatedRun = await workflowRunRepo.findById(run.id);
      expect(updatedRun?.status).toBe(WorkflowRunStatus.CANCELLED);

      const task1 = Array.from(taskRunRepo.runs.values()).find(
        (t) => t.taskDefinitionId === 'task-1',
      );
      expect(task1?.status).toBe(TaskRunStatus.CANCELLED);
      expect(task1?.error).toContain('Task cancelled');
    });
  });

  describe('WOE-04: Replay Preserves Workflow Version Lineage', () => {
    it('should maintain original workflowVersion when replaying after workflow version bump', async () => {
      // 1. Run workflow at version 1
      const originalRun = await engine.startWorkflow('wf-100');
      expect(originalRun.workflowVersion).toBe(1);

      // Transition to FAILED to allow replay
      originalRun.status = WorkflowRunStatus.FAILED;
      await workflowRunRepo.update(originalRun.id, {
        status: WorkflowRunStatus.FAILED,
      });

      // 2. Bump workflow version to 2
      await workflowRepo.update('wf-100', { version: 2 });

      // 3. Replay original run
      const replayedRun = await replayService.replayWorkflow(originalRun.id);

      // The replayed run MUST preserve the original run's workflowVersion
      expect(replayedRun.workflowVersion).toBe(1);
      expect(replayedRun.replayedFromId).toBe(originalRun.id);
    });
  });
});
