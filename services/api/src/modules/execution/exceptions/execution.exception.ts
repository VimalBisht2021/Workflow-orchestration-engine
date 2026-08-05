import { DomainError } from '../../workflow/exceptions/domain.exception';

export class InvalidWorkflowRunStateTransitionError extends DomainError {
  constructor(runId: string, from: string, to: string) {
    super(`Cannot transition WorkflowRun ${runId} from ${from} to ${to}`);
  }
}

export class InvalidTaskRunStateTransitionError extends DomainError {
  constructor(taskRunId: string, from: string, to: string) {
    super(`Cannot transition TaskRun ${taskRunId} from ${from} to ${to}`);
  }
}
