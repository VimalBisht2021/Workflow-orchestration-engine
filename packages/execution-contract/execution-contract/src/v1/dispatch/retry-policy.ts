export interface RetryPolicy {
  maxRetries: number;
  delayMs: number;
  backoffStrategy: 'FIXED' | 'LINEAR' | 'EXPONENTIAL';
}
