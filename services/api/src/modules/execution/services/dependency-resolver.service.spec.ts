import { DependencyResolver } from './dependency-resolver.service';
import { TaskRun } from '../entities/task-run.entity';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import { TaskRunStatus, BackoffStrategy } from '@prisma/client';

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  const createDef = (id: string, deps: string[] = []): TaskDefinition => {
    return new TaskDefinition(
      id,
      `Task ${id}`,
      'some-handler',
      deps,
      0,
      1000,
      BackoffStrategy.FIXED,
    );
  };

  const createRun = (
    id: string,
    defId: string,
    status: TaskRunStatus,
  ): TaskRun => {
    return new TaskRun(
      id,
      'wr-1',
      defId,
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

  it('should return pending tasks with no dependencies', () => {
    const defs = [createDef('td-1')];
    const runs = [createRun('tr-1', 'td-1', TaskRunStatus.PENDING)];

    const ready = resolver.getReadyTasks(defs, runs);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('tr-1');
  });

  it('should not return scheduled or running tasks', () => {
    const defs = [createDef('td-1')];
    const runs = [
      createRun('tr-1', 'td-1', TaskRunStatus.SCHEDULED),
      createRun('tr-2', 'td-1', TaskRunStatus.RUNNING),
    ];

    const ready = resolver.getReadyTasks(defs, runs);
    expect(ready).toHaveLength(0);
  });

  it('should return tasks when all dependencies are completed', () => {
    const defs = [
      createDef('td-1'), // A
      createDef('td-2', ['td-1']), // B depends on A
    ];
    const runs = [
      createRun('tr-1', 'td-1', TaskRunStatus.COMPLETED), // A is done
      createRun('tr-2', 'td-2', TaskRunStatus.PENDING), // B is pending
    ];

    const ready = resolver.getReadyTasks(defs, runs);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('tr-2');
  });

  it('should not return tasks if any dependency is not completed', () => {
    const defs = [
      createDef('td-1'), // A
      createDef('td-2', ['td-1']), // B depends on A
    ];
    const runs = [
      createRun('tr-1', 'td-1', TaskRunStatus.RUNNING), // A is running
      createRun('tr-2', 'td-2', TaskRunStatus.PENDING), // B is pending
    ];

    const ready = resolver.getReadyTasks(defs, runs);
    expect(ready).toHaveLength(0);
  });

  it('should not return tasks if dependency is failed', () => {
    const defs = [
      createDef('td-1'), // A
      createDef('td-2', ['td-1']), // B depends on A
    ];
    const runs = [
      createRun('tr-1', 'td-1', TaskRunStatus.FAILED), // A is failed
      createRun('tr-2', 'td-2', TaskRunStatus.PENDING), // B is pending
    ];

    const ready = resolver.getReadyTasks(defs, runs);
    expect(ready).toHaveLength(0); // B is blocked
  });
});
