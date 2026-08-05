import { Workflow } from './workflow.entity';
import { TaskDefinition } from './task-definition.entity';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { BackoffStrategy } from '@prisma/client';
import {
  CyclicDependencyError,
  MissingDependencyError,
  WorkflowAlreadyPublishedError,
} from '../exceptions/domain.exception';

describe('Workflow Entity', () => {
  let workflow: Workflow;

  beforeEach(() => {
    workflow = new Workflow(
      'wf-1',
      'Test Workflow',
      'Desc',
      'user-1',
      [],
      1,
      WorkflowStatus.DRAFT,
      new Date(),
    );
  });

  const createTask = (id: string, deps: string[] = []): TaskDefinition => {
    return new TaskDefinition(
      id,
      'Test Task',
      'test-handler',
      deps,
      0,
      1000,
      BackoffStrategy.FIXED,
    );
  };

  describe('addTask', () => {
    it('should add a task to the workflow', () => {
      workflow.addTask(createTask('t-1'));
      expect(workflow.tasks.length).toBe(1);
    });

    it('should throw if workflow is published', () => {
      workflow.status = WorkflowStatus.PUBLISHED;
      expect(() => workflow.addTask(createTask('t-1'))).toThrow(
        WorkflowAlreadyPublishedError,
      );
    });

    it('should reset status to DRAFT if VALIDATED', () => {
      workflow.status = WorkflowStatus.VALIDATED;
      workflow.addTask(createTask('t-1'));
      expect(workflow.status).toBe(WorkflowStatus.DRAFT);
    });
  });

  describe('validateGraph', () => {
    it('should pass for a valid linear graph', () => {
      workflow.addTask(createTask('t-1', []));
      workflow.addTask(createTask('t-2', ['t-1']));
      workflow.addTask(createTask('t-3', ['t-2']));

      expect(() => workflow.validateGraph()).not.toThrow();
    });

    it('should pass for a valid diamond graph', () => {
      workflow.addTask(createTask('t-1', []));
      workflow.addTask(createTask('t-2', ['t-1']));
      workflow.addTask(createTask('t-3', ['t-1']));
      workflow.addTask(createTask('t-4', ['t-2', 't-3']));

      expect(() => workflow.validateGraph()).not.toThrow();
    });

    it('should throw MissingDependencyError for a missing dependency', () => {
      workflow.addTask(createTask('t-1', []));
      workflow.addTask(createTask('t-2', ['t-1', 't-missing']));

      expect(() => workflow.validateGraph()).toThrow(MissingDependencyError);
    });

    it('should throw CyclicDependencyError for a direct cycle', () => {
      workflow.addTask(createTask('t-1', ['t-2']));
      workflow.addTask(createTask('t-2', ['t-1']));

      expect(() => workflow.validateGraph()).toThrow(CyclicDependencyError);
    });

    it('should throw CyclicDependencyError for an indirect cycle', () => {
      workflow.addTask(createTask('t-1', []));
      workflow.addTask(createTask('t-2', ['t-1']));
      workflow.addTask(createTask('t-3', ['t-2']));
      workflow.addTask(createTask('t-4', ['t-3']));
      // Introduce cycle
      workflow.addTask(createTask('t-5', ['t-4', 't-2']));

      // t-2 is not depending on t-5, but let's make t-2 depend on t-5
      workflow.tasks.find((t) => t.id === 't-2')!.dependencies.push('t-5');

      expect(() => workflow.validateGraph()).toThrow(CyclicDependencyError);
    });

    it('should throw CyclicDependencyError for a self-referencing cycle', () => {
      workflow.addTask(createTask('t-1', ['t-1']));

      expect(() => workflow.validateGraph()).toThrow(CyclicDependencyError);
    });
  });

  describe('validate', () => {
    it('should call validateGraph and transition to VALIDATED', () => {
      workflow.addTask(createTask('t-1', []));
      workflow.validate();
      expect(workflow.status).toBe(WorkflowStatus.VALIDATED);
    });
  });
});
