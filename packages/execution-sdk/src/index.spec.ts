import { ExecutionClient } from './index';
import { DispatchRequest } from '@local/execution-contract';

describe('ExecutionClient Guard Test', () => {
  it('should construct URLs matching DTPs mount path (/jobs)', async () => {
    // DTP mounts the jobs router directly at /jobs without an /api prefix.
    // This test ensures the SDK paths are not accidentally prefixed with /api.
    const client = new ExecutionClient({
      baseUrl: 'http://dtp-api:4000',
      apiKey: 'test-key',
      webhookUrl: 'http://woe/webhook'
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'job-123', status: 'RUNNING' }),
      text: async () => ''
    });
    global.fetch = mockFetch;

    // Test getJobStatus
    await client.getJobStatus('idemp-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://dtp-api:4000/jobs/by-idempotency-key/idemp-123',
      expect.any(Object)
    );

    // Test cancelJob
    await client.cancelJob('idemp-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://dtp-api:4000/jobs/job-123/cancel',
      expect.any(Object)
    );

    // Test dispatch
    const req: DispatchRequest = {
      idempotencyKey: 'test',
      workflowRunId: 'wr',
      workflowVersion: 1,
      taskRunId: 'tr',
      handler: 'core/script',
      input: {},
      correlationId: 'c1'
    };
    await client.dispatch(req);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://dtp-api:4000/jobs',
      expect.any(Object)
    );
  });
});
