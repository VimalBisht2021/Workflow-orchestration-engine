import { TaskRun } from './task-run.entity';
import { TaskRunStatus } from '@prisma/client';
import { InvalidTaskRunStateTransitionError } from '../exceptions/execution.exception';

describe('TaskRun Entity', () => {
  let taskRun: TaskRun;

  beforeEach(() => {
    taskRun = new TaskRun(
      'tr-1',
      'wr-1',
      'td-1',
      TaskRunStatus.PENDING,
      null, // input
      null, // output
      null, // error
      null, // queuedAt
      null, // startedAt
      null, // completedAt
      new Date(),
      new Date(),
    );
  });

  it('should initialize correctly', () => {
    expect(taskRun.isPending()).toBe(true);
    expect(taskRun.isTerminal()).toBe(false);
  });

  describe('schedule', () => {
    it('should transition from PENDING to SCHEDULED', () => {
      taskRun.schedule();
      expect(taskRun.isScheduled()).toBe(true);
      expect(taskRun.queuedAt).toBeInstanceOf(Date);
    });

    it('should throw if not PENDING', () => {
      taskRun.status = TaskRunStatus.RUNNING;
      expect(() => taskRun.schedule()).toThrow(
        InvalidTaskRunStateTransitionError,
      );
    });
  });

  describe('start', () => {
    it('should transition from SCHEDULED to RUNNING', () => {
      taskRun.status = TaskRunStatus.SCHEDULED;
      taskRun.start();
      expect(taskRun.isRunning()).toBe(true);
      expect(taskRun.startedAt).toBeInstanceOf(Date);
    });

    it('should throw if not SCHEDULED', () => {
      expect(() => taskRun.start()).toThrow(InvalidTaskRunStateTransitionError);
    });
  });

  describe('complete', () => {
    it('should transition from RUNNING to COMPLETED', () => {
      taskRun.status = TaskRunStatus.RUNNING;
      taskRun.complete({ result: 'ok' });
      expect(taskRun.isCompleted()).toBe(true);
      expect(taskRun.isTerminal()).toBe(true);
      expect(taskRun.output).toEqual({ result: 'ok' });
      expect(taskRun.completedAt).toBeInstanceOf(Date);
    });

    it('should throw if not RUNNING', () => {
      expect(() => taskRun.complete({ result: 'ok' })).toThrow(
        InvalidTaskRunStateTransitionError,
      );
    });
  });

  describe('fail', () => {
    it('should transition from RUNNING to FAILED', () => {
      taskRun.status = TaskRunStatus.RUNNING;
      taskRun.fail('Some error');
      expect(taskRun.isFailed()).toBe(true);
      expect(taskRun.isTerminal()).toBe(true);
      expect(taskRun.error).toBe('Some error');
      expect(taskRun.completedAt).toBeInstanceOf(Date);
    });

    it('should throw if not RUNNING', () => {
      expect(() => taskRun.fail('Error')).toThrow(
        InvalidTaskRunStateTransitionError,
      );
    });
  });

  describe('skip', () => {
    it('should transition to SKIPPED', () => {
      taskRun.skip();
      expect(taskRun.isSkipped()).toBe(true);
      expect(taskRun.isTerminal()).toBe(true);
      expect(taskRun.completedAt).toBeInstanceOf(Date);
    });

    it('should throw if already terminal', () => {
      taskRun.status = TaskRunStatus.COMPLETED;
      expect(() => taskRun.skip()).toThrow(InvalidTaskRunStateTransitionError);
    });

    it('should throw if RUNNING', () => {
      taskRun.status = TaskRunStatus.RUNNING;
      expect(() => taskRun.skip()).toThrow(InvalidTaskRunStateTransitionError);
    });
  });
});
