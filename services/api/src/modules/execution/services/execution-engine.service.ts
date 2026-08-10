import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import * as crypto from 'crypto';
import { OnEvent } from '@nestjs/event-emitter';
import type { WorkflowRepository } from '../../workflow/repositories/workflow.repository';
import { WORKFLOW_REPOSITORY } from '../../workflow/repositories/workflow.repository';
import type { WorkflowRunRepository } from '../repositories/workflow-run.repository';
import { WORKFLOW_RUN_REPOSITORY } from '../repositories/workflow-run.repository';
import type { TaskRunRepository } from '../repositories/task-run.repository';
import { TASK_RUN_REPOSITORY } from '../repositories/task-run.repository';
import { WorkflowRunFactory } from './workflow-run.factory';
import { DependencyResolver } from './dependency-resolver.service';
import type { TaskExecutionGateway } from '../dispatchers/task-execution-gateway.interface';
import { TASK_EXECUTION_GATEWAY } from '../dispatchers/task-execution-gateway.interface';
import type { FailureStrategy } from './failure-strategy.interface';
import { FAILURE_STRATEGY } from './failure-strategy.interface';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { HandlerRegistry } from '../handlers/handler.registry';
import type { DomainEventPublisher } from '../events/domain/domain-event-publisher.interface';
import { DOMAIN_EVENT_PUBLISHER } from '../events/domain/domain-event-publisher.interface';
import {
  WorkflowStartedDomainEvent,
  TaskCompletedDomainEvent,
  TaskFailedDomainEvent,
} from '../events/domain/domain-events';
import { ObservabilityService } from '../../observability/observability.service';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import { TaskRun } from '../entities/task-run.entity';
import type { DispatchRequest } from '@local/execution-contract';

@Injectable()
export class ExecutionEngine {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
    @Inject(WORKFLOW_RUN_REPOSITORY)
    private readonly workflowRunRepository: WorkflowRunRepository,
    @Inject(TASK_RUN_REPOSITORY)
    private readonly taskRunRepository: TaskRunRepository,
    private readonly workflowRunFactory: WorkflowRunFactory,
    private readonly dependencyResolver: DependencyResolver,
    private readonly handlerRegistry: HandlerRegistry,
    @Inject(TASK_EXECUTION_GATEWAY)
    private readonly taskGateway: TaskExecutionGateway,
    @Inject(FAILURE_STRATEGY) private readonly failureStrategy: FailureStrategy,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async startWorkflow(workflowId: string): Promise<WorkflowRun> {
    const span = this.observabilityService.startSpan('WorkflowRun', {
      'workflow.id': workflowId,
    });

    try {
      const workflow = await this.workflowRepository.findById(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found.`);
      }

      span.setAttribute('workflow.version', workflow.version);

      // Validate that all handlers referenced in the workflow are registered
      for (const def of workflow.tasks) {
        if (!this.handlerRegistry.has(def.handler)) {
          throw new Error(`Handler '${def.handler}' is not registered.`);
        }
      }

      const workflowRun = this.workflowRunFactory.create(workflow);

      const correlationId = span.spanContext().traceId || crypto.randomUUID();
      span.setAttribute('workflow.run_id', workflowRun.id);
      span.setAttribute('correlation.id', correlationId);

      // Persist run and task runs
      await this.workflowRunRepository.create(workflowRun);
      for (const tr of workflowRun.taskRuns) {
        await this.taskRunRepository.create(tr);
      }

      workflowRun.start();
      await this.workflowRunRepository.update(workflowRun.id, {
        status: workflowRun.status,
        startedAt: workflowRun.startedAt,
      });

      await this.eventPublisher.publish(
        new WorkflowStartedDomainEvent(workflowRun.id),
      );
      this.observabilityService.recordWorkflowStart();

      return workflowRun;
    } catch (error: any) {
      this.observabilityService.recordException(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  @OnEvent(WorkflowStartedDomainEvent.name)
  async handleWorkflowStarted(
    event: WorkflowStartedDomainEvent,
  ): Promise<void> {
    await this.reconcile(event.workflowRunId);
  }

  @OnEvent(TaskCompletedDomainEvent.name)
  async handleTaskCompleted(event: TaskCompletedDomainEvent): Promise<void> {
    await this.reconcile(event.workflowRunId);
  }

  @OnEvent(TaskFailedDomainEvent.name)
  async handleTaskFailed(event: TaskFailedDomainEvent): Promise<void> {
    await this.reconcile(event.workflowRunId);
  }

  /**
   * Centralized state reconciliation algorithm.
   *
   * Evaluates the DAG, detects failures, determines ready tasks,
   * constructs dispatch requests, and sends them through the
   * TaskExecutionGateway.
   */
  async reconcile(workflowRunId: string): Promise<void> {
    const workflowRun =
      await this.workflowRunRepository.findById(workflowRunId);
    if (!workflowRun)
      throw new Error(`WorkflowRun ${workflowRunId} not found.`);

    if (workflowRun.isTerminal()) {
      return; // Nothing to do
    }

    const workflow = await this.workflowRepository.findById(
      workflowRun.workflowId,
    );
    if (!workflow)
      throw new Error(`Workflow ${workflowRun.workflowId} not found.`);

    // Build lookup for task definitions
    const definitionMap = new Map<string, TaskDefinition>(
      workflow.tasks.map((d) => [d.id, d]),
    );

    // 1. Check for failures
    const hasUnrecoverableFailure = workflowRun.taskRuns.some(
      (tr) => tr.status === 'FAILED',
    );
    if (hasUnrecoverableFailure) {
      await this.failureStrategy.handleWorkflowFailure(workflowRun);
      this.observabilityService.recordWorkflowFailure(
        (Date.now() - workflowRun.startedAt!.getTime()) / 1000,
      );
      return;
    }

    // 2. Check if completed
    const allTerminal = workflowRun.taskRuns.every((tr) => tr.isTerminal());
    if (allTerminal) {
      workflowRun.complete();
      await this.workflowRunRepository.update(workflowRun.id, {
        status: workflowRun.status,
        completedAt: workflowRun.completedAt,
      });
      this.observabilityService.recordWorkflowCompletion(
        (workflowRun.completedAt!.getTime() -
          workflowRun.startedAt!.getTime()) /
          1000,
      );
      return;
    }

    // 3. Determine ready tasks and dispatch them
    const readyTasks = this.dependencyResolver.getReadyTasks(
      workflow.tasks,
      workflowRun.taskRuns,
    );

    for (const readyTask of readyTasks) {
      const wonRace = await this.taskRunRepository.atomicUpdateStatus(
        readyTask.id,
        'PENDING',
        'SCHEDULED',
      );
      if (!wonRace) continue;

      readyTask.schedule();
      await this.taskRunRepository.update(readyTask.id, {
        queuedAt: readyTask.queuedAt,
      });

      // Construct the versioned dispatch request
      const request = this.buildDispatchRequest(
        readyTask,
        workflowRun,
        definitionMap,
      );
      await this.taskGateway.dispatch(request);
    }
  }

  /**
   * Constructs a versioned DispatchRequest from the
   * orchestration context. This keeps request construction centralized
   * in the engine and out of the gateway implementation.
   */
  private buildDispatchRequest(
    taskRun: TaskRun,
    workflowRun: WorkflowRun,
    definitionMap: Map<string, TaskDefinition>,
  ): DispatchRequest {
    const definition = definitionMap.get(taskRun.taskDefinitionId);
    if (!definition) {
      throw new Error(
        `TaskDefinition ${taskRun.taskDefinitionId} not found for TaskRun ${taskRun.id}`,
      );
    }

    const activeSpan = trace.getActiveSpan();
    const traceparent = activeSpan
      ? `00-${activeSpan.spanContext().traceId}-${activeSpan.spanContext().spanId}-0${activeSpan.spanContext().traceFlags.toString(16).padStart(2, '0')}`
      : undefined;

    return {
      idempotencyKey: `${workflowRun.id}:${taskRun.id}`,
      taskRunId: taskRun.id,
      workflowRunId: workflowRun.id,
      workflowVersion: workflowRun.workflowVersion,
      handler: definition.handler,
      input: taskRun.input ?? definition.configuration,
      retryPolicy:
        definition.maxRetries > 0
          ? {
              maxRetries: definition.maxRetries,
              delayMs: definition.retryDelayMs,
              backoffStrategy: definition.backoffStrategy,
            }
          : null,
      timeoutMs: definition.timeoutMs ?? null,
      correlationId:
        activeSpan?.spanContext().traceId || `corr-${workflowRun.id}`,
      traceparent,
      capabilities: {},
    };
  }
}
