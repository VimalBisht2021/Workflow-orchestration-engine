import { BackoffStrategy } from '@prisma/client';

export class TaskDefinition {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly handler: string,
    public readonly dependencies: string[],
    public readonly maxRetries: number,
    public readonly retryDelayMs: number,
    public readonly backoffStrategy: BackoffStrategy,
    public readonly configuration?: any,
    public readonly timeoutMs?: number,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}
}
