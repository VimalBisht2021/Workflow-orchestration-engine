import { DispatchRequest, DispatchResponse } from '@local/execution-contract';

export interface ExecutionClientConfig {
  baseUrl: string;
  apiKey: string;
  webhookUrl: string;
}

export class DispatchRequestMapper {
  static toCreateJobDto(request: DispatchRequest, webhookUrl: string) {
    return {
      idempotencyKey: request.idempotencyKey,
      jobType: request.handler,
      payload: {
        workflowRunId: request.workflowRunId,
        workflowVersion: request.workflowVersion,
        taskRunId: request.taskRunId,
        correlationId: request.correlationId,
        traceparent: request.traceparent,
        input: request.input,
        dispatchedAt: new Date().toISOString(),
      },
      callback: {
        url: webhookUrl,
        timeout: request.timeoutMs || 30000,
        retryPolicy: request.retryPolicy,
      },
      priority: 'HIGH',
    };
  }
}

export class ExecutionClient {
  constructor(private config: ExecutionClientConfig) {}

  /**
   * Dispatches a task to the Distributed Task Platform (DTP) using the DTP Adapter.
   */
  async dispatch(request: DispatchRequest): Promise<DispatchResponse> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/api/jobs`;
    const dtpPayload = DispatchRequestMapper.toCreateJobDto(request, this.config.webhookUrl);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify(dtpPayload),
    });

    if (!response.ok && response.status !== 409) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`ExecutionClient dispatch failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  /**
   * Gets the status of a job from DTP by idempotency key
   */
  async getJobStatus(idempotencyKey: string): Promise<any> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/api/jobs/by-idempotency-key/${idempotencyKey}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.config.apiKey,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`ExecutionClient getJobStatus failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }
}
