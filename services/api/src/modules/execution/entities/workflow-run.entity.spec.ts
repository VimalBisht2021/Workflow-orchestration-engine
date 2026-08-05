import { WorkflowRun } from './workflow-run.entity';
import { TaskRun } from './task-run.entity';
import { WorkflowRunStatus, TaskRunStatus } from '@prisma/client';
import { InvalidWorkflowRunStateTransitionError } from '../exceptions/execution.exception';

describe('WorkflowRun Entity', () => {
  let workflowRun: WorkflowRun;

  beforeEach(() => {
    workflowRun = new WorkflowRun(
      'wr-1',
      'wf-1',
      1,
      WorkflowRunStatus.PENDING,
      null,
      null,
      null,
      new Date(),
      new Date(),
    );
  });

  const createTaskRun = (id: string, status: TaskRunStatus): TaskRun => {
    return new TaskRun(
      id,
      'wr-1',
      'td-1',
      status,
      null, // input
      null, // output
      null, // error
      null, // queuedAt
      null, // startedAt
      null, // completedAt
      new Date(),
      new Date(),
    );
  };

  it('should initialize correctly', () => {
    expect(workflowRun.isPending()).toBe(true);
    expect(workflowRun.isTerminal()).toBe(false);
  });

  describe('queue', () => {
    it('should set queuedAt if PENDING', () => {
      workflowRun.queue();
      expect(workflowRun.queuedAt).toBeInstanceOf(Date);
    });

    it('should throw if not PENDING', () => {
      workflowRun.status = WorkflowRunStatus.RUNNING;
      expect(() => workflowRun.queue()).toThrow(
        InvalidWorkflowRunStateTransitionError,
      );
    });
  });

  describe('start', () => {
    it('should transition from PENDING to RUNNING', () => {
      workflowRun.start();
      expect(workflowRun.isRunning()).toBe(true);
      expect(workflowRun.startedAt).toBeInstanceOf(Date);
    });

    it('should throw if not PENDING', () => {
      workflowRun.status = WorkflowRunStatus.RUNNING;
      expect(() => workflowRun.start()).toThrow(
        InvalidWorkflowRunStateTransitionError,
      );
    });
  });

  describe('complete', () => {
    it('should transition from RUNNING to COMPLETED if all tasks are terminal', () => {
      workflowRun.status = WorkflowRunStatus.RUNNING;
      workflowRun.taskRuns = [
        createTaskRun('tr-1', TaskRunStatus.COMPLETED),
        createTaskRun('tr-2', TaskRunStatus.SKIPPED),
      ];
      workflowRun.complete();
      expect(workflowRun.isCompleted()).toBe(true);
      expect(workflowRun.isTerminal()).toBe(true);
    });

    it('should throw if any task is non-terminal', () => {
      workflowRun.status = WorkflowRunStatus.RUNNING;
      workflowRun.taskRuns = [
        createTaskRun('tr-1', TaskRunStatus.COMPLETED),
        createTaskRun('tr-2', TaskRunStatus.RUNNING),
      ];
      expect(() => workflowRun.complete()).toThrow(/non-terminal tasks/);
    });

    it('should throw if any task failed', () => {
      workflowRun.status = WorkflowRunStatus.RUNNING;
      workflowRun.taskRuns = [
        createTaskRun('tr-1', TaskRunStatus.COMPLETED),
        createTaskRun('tr-2', TaskRunStatus.FAILED),
      ];
      expect(() => workflowRun.complete()).toThrow(/failed tasks/);
    });

    it('should throw if not RUNNING', () => {
      expect(() => workflowRun.complete()).toThrow(
        InvalidWorkflowRunStateTransitionError,
      );
    });
  });

  describe('fail', () => {
    it('should transition from RUNNING to FAILED', () => {
      workflowRun.status = WorkflowRunStatus.RUNNING;
      workflowRun.fail();
      expect(workflowRun.isFailed()).toBe(true);
      expect(workflowRun.isTerminal()).toBe(true);
    });

    it('should transition from PENDING to FAILED', () => {
      workflowRun.fail();
      expect(workflowRun.isFailed()).toBe(true);
    });

    it('should throw if COMPLETED', () => {
      workflowRun.status = WorkflowRunStatus.COMPLETED;
      expect(() => workflowRun.fail()).toThrow(
        InvalidWorkflowRunStateTransitionError,
      );
    });
  });

  describe('cancel', () => {
    it('should transition to CANCELLED', () => {
      workflowRun.cancel();
      expect(workflowRun.isCancelled()).toBe(true);
      expect(workflowRun.isTerminal()).toBe(true);
    });

    it('should throw if already terminal', () => {
      workflowRun.status = WorkflowRunStatus.COMPLETED;
      expect(() => workflowRun.cancel()).toThrow(
        InvalidWorkflowRunStateTransitionError,
      );
    });
  });
});
