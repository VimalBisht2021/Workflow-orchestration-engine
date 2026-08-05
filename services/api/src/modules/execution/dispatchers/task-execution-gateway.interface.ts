import { DispatchRequest } from '@local/execution-contract';

export const TASK_EXECUTION_GATEWAY = 'TASK_EXECUTION_GATEWAY';

export interface TaskExecutionGateway {
  dispatch(request: DispatchRequest): Promise<void>;
}
