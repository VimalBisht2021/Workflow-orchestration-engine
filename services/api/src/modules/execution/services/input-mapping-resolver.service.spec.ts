import {
  InputMappingResolverService,
  InputMappingResolutionError,
  getAncestorIds,
} from './input-mapping-resolver.service';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import { TaskRun } from '../entities/task-run.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { BackoffStrategy, TaskRunStatus, WorkflowRunStatus } from '@prisma/client';

describe('InputMappingResolverService (Comprehensive Unit Tests)', () => {
  let resolver: InputMappingResolverService;
  let mockWorkflowRun: WorkflowRun;

  beforeEach(() => {
    resolver = new InputMappingResolverService();
    mockWorkflowRun = new WorkflowRun(
      'wr-100',
      'wf-1',
      1,
      WorkflowRunStatus.RUNNING,
      new Date(),
      new Date(),
      null,
      new Date(),
      new Date(),
    );
  });

  const createDef = (
    id: string,
    dependencies: string[] = [],
    inputMapping?: Record<string, { sourceNodeId: string; path: string[] }>,
    config: any = {},
  ) =>
    new TaskDefinition(
      id,
      `Task ${id}`,
      'core/script',
      dependencies,
      0,
      1000,
      BackoffStrategy.FIXED,
      { ...config, inputMapping },
      undefined,
      undefined,
      undefined,
      inputMapping,
    );

  const createMockRun = (
    id: string,
    defId: string,
    status: TaskRunStatus = TaskRunStatus.PENDING,
    output: any = null,
    input: any = null,
  ): TaskRun =>
    new TaskRun(
      id,
      'wr-100',
      defId,
      status,
      input,
      output,
      null,
      new Date(),
      new Date(),
      status === TaskRunStatus.COMPLETED ? new Date() : null,
      new Date(),
      new Date(),
    );

  // Test 1: Mapping a simple root-level property
  it('1. should map a simple root-level property', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      statusCode: { sourceNodeId: 'task-root', path: ['statusCode'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);
    const runMap = new Map([
      [
        'task-root',
        createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, {
          statusCode: 200,
        }),
      ],
    ]);

    const childRun = createMockRun('tr-child', 'task-child');
    const resolved = resolver.resolve(
      childTask,
      childRun,
      mockWorkflowRun,
      defMap,
      runMap,
    );

    expect(resolved).toEqual({ statusCode: 200 });
  });

  // Test 2: Mapping nested properties
  it('2. should map deeply nested properties', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      userId: { sourceNodeId: 'task-root', path: ['body', 'user', 'id'] },
      email: { sourceNodeId: 'task-root', path: ['body', 'user', 'email'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);
    const runMap = new Map([
      [
        'task-root',
        createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, {
          body: {
            user: {
              id: 'usr_8834',
              email: 'jane@example.com',
            },
          },
        }),
      ],
    ]);

    const childRun = createMockRun('tr-child', 'task-child');
    const resolved = resolver.resolve(
      childTask,
      childRun,
      mockWorkflowRun,
      defMap,
      runMap,
    );

    expect(resolved).toEqual({
      userId: 'usr_8834',
      email: 'jane@example.com',
    });
  });

  // Test 3: Mapping array elements
  it('3. should map array elements by numeric index', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      secondItemName: { sourceNodeId: 'task-root', path: ['items', '1', 'name'] },
      firstItemId: { sourceNodeId: 'task-root', path: ['items', '0', 'id'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);
    const runMap = new Map([
      [
        'task-root',
        createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, {
          items: [
            { id: 101, name: 'First Item' },
            { id: 102, name: 'Second Item' },
          ],
        }),
      ],
    ]);

    const childRun = createMockRun('tr-child', 'task-child');
    const resolved = resolver.resolve(
      childTask,
      childRun,
      mockWorkflowRun,
      defMap,
      runMap,
    );

    expect(resolved).toEqual({
      secondItemName: 'Second Item',
      firstItemId: 101,
    });
  });

  // Test 4: Mapping data from different upstream nodes
  it('4. should map data from multiple different upstream predecessor nodes', () => {
    const taskA = createDef('task-a');
    const taskB = createDef('task-b');
    const taskC = createDef('task-c', ['task-a', 'task-b'], {
      userToken: { sourceNodeId: 'task-a', path: ['auth', 'token'] },
      itemPrice: { sourceNodeId: 'task-b', path: ['price'] },
    });

    const defMap = new Map([
      ['task-a', taskA],
      ['task-b', taskB],
      ['task-c', taskC],
    ]);
    const runMap = new Map([
      [
        'task-a',
        createMockRun('tr-a', 'task-a', TaskRunStatus.COMPLETED, {
          auth: { token: 'jwt-xyz-123' },
        }),
      ],
      [
        'task-b',
        createMockRun('tr-b', 'task-b', TaskRunStatus.COMPLETED, {
          price: 99.95,
        }),
      ],
    ]);

    const childRun = createMockRun('tr-c', 'task-c');
    const resolved = resolver.resolve(
      taskC,
      childRun,
      mockWorkflowRun,
      defMap,
      runMap,
    );

    expect(resolved).toEqual({
      userToken: 'jwt-xyz-123',
      itemPrice: 99.95,
    });
  });

  // Test 5: Mapping through parallel upstream branches after all dependencies complete
  it('5. should resolve correctly through a Diamond parallel fan-out and join', () => {
    const root = createDef('task-root');
    const branchA = createDef('task-a', ['task-root']);
    const branchB = createDef('task-b', ['task-root']);
    const joinNode = createDef('task-join', ['task-a', 'task-b'], {
      resA: { sourceNodeId: 'task-a', path: ['result', 'count'] },
      resB: { sourceNodeId: 'task-b', path: ['result', 'total'] },
      rootMeta: { sourceNodeId: 'task-root', path: ['meta', 'traceId'] },
    });

    const defMap = new Map([
      ['task-root', root],
      ['task-a', branchA],
      ['task-b', branchB],
      ['task-join', joinNode],
    ]);

    // Transitive ancestors of joinNode include task-a, task-b, AND task-root
    const ancestors = getAncestorIds('task-join', defMap);
    expect(ancestors.has('task-a')).toBe(true);
    expect(ancestors.has('task-b')).toBe(true);
    expect(ancestors.has('task-root')).toBe(true);

    const runMap = new Map([
      [
        'task-root',
        createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, {
          meta: { traceId: 'trace-4040' },
        }),
      ],
      [
        'task-a',
        createMockRun('tr-a', 'task-a', TaskRunStatus.COMPLETED, {
          result: { count: 42 },
        }),
      ],
      [
        'task-b',
        createMockRun('tr-b', 'task-b', TaskRunStatus.COMPLETED, {
          result: { total: 1000 },
        }),
      ],
    ]);

    const joinRun = createMockRun('tr-join', 'task-join');
    const resolved = resolver.resolve(
      joinNode,
      joinRun,
      mockWorkflowRun,
      defMap,
      runMap,
    );

    expect(resolved).toEqual({
      resA: 42,
      resB: 1000,
      rootMeta: 'trace-4040',
    });
  });

  // Test 6: Missing source output
  it('6. should throw actionable error if source output is missing or null', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      data: { sourceNodeId: 'task-root', path: ['val'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);
    const runMap = new Map([
      ['task-root', createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, null)],
    ]);

    const childRun = createMockRun('tr-child', 'task-child');
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(InputMappingResolutionError);
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(/source output is null or undefined/);
  });

  // Test 7: Missing property path
  it('7. should throw actionable error if target property path does not exist', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      nonExistent: { sourceNodeId: 'task-root', path: ['body', 'missingKey'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);
    const runMap = new Map([
      [
        'task-root',
        createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, {
          body: { existingKey: 1 },
        }),
      ],
    ]);

    const childRun = createMockRun('tr-child', 'task-child');
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(InputMappingResolutionError);
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(/property 'missingKey' does not exist on source output/);
  });

  // Test 8: Null source values along traversal path
  it('8. should throw actionable error if null is encountered along traversal path', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      nested: { sourceNodeId: 'task-root', path: ['user', 'profile', 'bio'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);
    const runMap = new Map([
      ['task-root', createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, { user: null })],
    ]);

    const childRun = createMockRun('tr-child', 'task-child');
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(InputMappingResolutionError);
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(/cannot read property 'profile' from null/);
  });

  // Test 9: Invalid dependency / source references (unrelated or downstream node)
  it('9. should reject mapping referencing unrelated or downstream nodes', () => {
    const taskA = createDef('task-a');
    const taskB = createDef('task-b'); // Not in dependencies of task-c
    const taskC = createDef('task-c', ['task-a'], {
      illegalData: { sourceNodeId: 'task-b', path: ['someField'] },
    });

    const defMap = new Map([
      ['task-a', taskA],
      ['task-b', taskB],
      ['task-c', taskC],
    ]);
    const runMap = new Map([
      ['task-a', createMockRun('tr-a', 'task-a', TaskRunStatus.COMPLETED, { ok: true })],
      ['task-b', createMockRun('tr-b', 'task-b', TaskRunStatus.COMPLETED, { someField: 123 })],
    ]);

    const childRun = createMockRun('tr-c', 'task-c');
    expect(() =>
      resolver.resolve(taskC, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(InputMappingResolutionError);
    expect(() =>
      resolver.resolve(taskC, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(/is not a declared dependency or ancestor/);
  });

  // Test 10: Prototype-related unsafe property paths
  it('10. should block prototype pollution attempts (__proto__, constructor, prototype)', () => {
    const rootTask = createDef('task-root');
    const childTask1 = createDef('task-child-1', ['task-root'], {
      exploit: { sourceNodeId: 'task-root', path: ['__proto__', 'polluted'] },
    });
    const childTask2 = createDef('task-child-2', ['task-root'], {
      exploit: { sourceNodeId: 'task-root', path: ['constructor', 'prototype'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child-1', childTask1],
      ['task-child-2', childTask2],
    ]);
    const runMap = new Map([
      ['task-root', createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, { test: 1 })],
    ]);

    const childRun1 = createMockRun('tr-1', 'task-child-1');
    const childRun2 = createMockRun('tr-2', 'task-child-2');

    expect(() =>
      resolver.resolve(childTask1, childRun1, mockWorkflowRun, defMap, runMap),
    ).toThrow(/unsafe property '__proto__'/);

    expect(() =>
      resolver.resolve(childTask2, childRun2, mockWorkflowRun, defMap, runMap),
    ).toThrow(/unsafe property 'constructor'/);
  });

  // Test 11: Invalid array indices
  it('11. should reject out-of-bounds or non-numeric array index segments', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      oob: { sourceNodeId: 'task-root', path: ['arr', '5'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);
    const runMap = new Map([
      ['task-root', createMockRun('tr-root', 'task-root', TaskRunStatus.COMPLETED, { arr: [10, 20] })],
    ]);

    const childRun = createMockRun('tr-c', 'task-child');
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(/invalid array index '5' for array of length 2/);
  });

  // Test 12: Incomplete source task status
  it('12. should reject resolving mapping if source task run has not completed', () => {
    const rootTask = createDef('task-root');
    const childTask = createDef('task-child', ['task-root'], {
      val: { sourceNodeId: 'task-root', path: ['status'] },
    });

    const defMap = new Map([
      ['task-root', rootTask],
      ['task-child', childTask],
    ]);

    const runningTaskRun = createMockRun('tr-root', 'task-root', TaskRunStatus.RUNNING);
    const runMap = new Map([['task-root', runningTaskRun]]);

    const childRun = createMockRun('tr-child', 'task-child');
    expect(() =>
      resolver.resolve(childTask, childRun, mockWorkflowRun, defMap, runMap),
    ).toThrow(/source task is currently in 'RUNNING' status/);
  });
});
