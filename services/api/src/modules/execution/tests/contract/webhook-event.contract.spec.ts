import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { WebhookEventDto } from '../../dto/webhook-event.dto';

describe('WebhookEventDto Contract', () => {
  it('should validate a payload matching DTP ExecutionEventMapper output', () => {
    // This represents the exact shape returned by ExecutionEventMapper.toWebhookPayload in DTP
    const dtpPayload = {
      eventId: 'abc123def',
      specVersion: '1.0',
      eventType: 'TASK_COMPLETED',
      occurredAt: new Date().toISOString(),
      payload: {
        taskRunId: 'tr-1',
        workflowRunId: 'wr-1',
        workflowVersion: 1,
        correlationId: 'corr-1',
        output: { some: 'data' },
        error: undefined,
      },
    };

    const instance = plainToInstance(WebhookEventDto, dtpPayload);
    const errors = validateSync(instance);

    // Detailed error logging for debugging if it fails
    if (errors.length > 0) {
      console.error(errors);
    }
    expect(errors.length).toBe(0);
  });
});
