import { RetryPolicy } from './retry-policy';

export interface ExecutionCapabilities {
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  executionClass?: string;
  [key: string]: unknown;
}

export interface DispatchRequest {
  taskRunId: string;
  workflowRunId: string;
  workflowVersion: number;
  handler: string;
  input: unknown;
  retryPolicy: RetryPolicy | null;
  timeoutMs: number | null;
  correlationId: string;
  traceparent?: string;
  capabilities?: ExecutionCapabilities;
}

export type DispatchResponse = void;
