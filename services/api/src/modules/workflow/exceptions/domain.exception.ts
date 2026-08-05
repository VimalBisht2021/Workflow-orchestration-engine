export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class WorkflowAlreadyPublishedError extends DomainError {
  constructor(workflowId: string) {
    super(`Workflow ${workflowId} is already published.`);
  }
}

export class WorkflowNotValidatedError extends DomainError {
  constructor(workflowId: string) {
    super(`Workflow ${workflowId} must be validated before publishing.`);
  }
}

export class WorkflowAlreadyValidatedError extends DomainError {
  constructor(workflowId: string) {
    super(`Workflow ${workflowId} is already validated.`);
  }
}

export class CyclicDependencyError extends DomainError {
  constructor(workflowId: string, cyclePath: string[]) {
    super(
      `Workflow ${workflowId} contains a cyclic dependency: ${cyclePath.join(' -> ')}`,
    );
  }
}

export class MissingDependencyError extends DomainError {
  constructor(workflowId: string, taskId: string, missingDependencyId: string) {
    super(
      `Workflow ${workflowId}: Task ${taskId} depends on missing task ${missingDependencyId}`,
    );
  }
}
