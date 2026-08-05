import { WorkflowRunFactory } from './workflow-run.factory';
import { Workflow } from '../../workflow/entities/workflow.entity';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import { BackoffStrategy } from '@prisma/client';
import { WorkflowStatus } from '../../workflow/enums/workflow-status.enum';

describe('WorkflowRunFactory', () => {
  let factory: WorkflowRunFactory;

  beforeEach(() => {
    factory = new WorkflowRunFactory();
  });

  it('should create a WorkflowRun and corresponding TaskRuns', () => {
    const workflow = new Workflow(
      'wf-1',
      'Test Workflow',
      undefined,
      'owner',
      [],
      1,
      WorkflowStatus.PUBLISHED,
      new Date(),
    );

    const task1 = new TaskDefinition(
      'td-1',
      'Task 1',
      'handler-1',
      [],
      2,
      1000,
      BackoffStrategy.FIXED,
    );

    workflow.tasks = [task1];

    const run = factory.create(workflow);

    expect(run).toBeDefined();
    expect(run.workflowId).toBe('wf-1');
    expect(run.workflowVersion).toBe(1);
    expect(run.isPending()).toBe(true);
    expect(run.taskRuns).toHaveLength(1);

    const taskRun = run.taskRuns[0];
    expect(taskRun.taskDefinitionId).toBe('td-1');
    expect(taskRun.isPending()).toBe(true);
    expect(taskRun.workflowRunId).toBe(run.id);
  });
});
