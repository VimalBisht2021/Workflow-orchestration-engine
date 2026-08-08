import { Injectable, Logger } from '@nestjs/common';
import { TaskExecutionGateway } from './task-execution-gateway.interface';
import { DispatchRequest } from '@local/execution-contract';
import { ExecutionClient } from '@local/execution-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RemoteTaskExecutionGateway implements TaskExecutionGateway {
  private readonly logger = new Logger(RemoteTaskExecutionGateway.name);
  private client: ExecutionClient;

  constructor(private configService: ConfigService) {
    this.client = new ExecutionClient({
      baseUrl:
        this.configService.get<string>('DTP_BASE_URL') ||
        'http://localhost:4000',
      apiKey:
        this.configService.get<string>('DTP_API_KEY') ||
        'dtp-secret-api-key',
      webhookUrl:
        this.configService.get<string>('WOE_WEBHOOK_URL') ||
        'http://localhost:3000/api/webhooks/tasks/events',
    });
  }

  async dispatch(request: DispatchRequest): Promise<void> {
    this.logger.log(
      `Dispatching task ${request.taskRunId} to DTP ` +
        `(workflow=${request.workflowRunId}, handler=${request.handler}, ` +
        `version=${request.workflowVersion})`,
    );
    this.logger.debug(`Dispatch payload: JSON omitted for brevity`);

    try {
      await this.client.dispatch(request);
    } catch (error) {
      this.logger.error(`Failed to dispatch to DTP: ${error.message}`);
      // In a real system, you might enqueue this locally or throw to retry
      throw error;
    }
  }
}
