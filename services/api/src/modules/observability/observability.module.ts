import { Global, Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { ObservabilityService } from './observability.service';

const metricProviders = [
  makeCounterProvider({
    name: 'workflow_starts_total',
    help: 'Total number of started workflows',
  }),
  makeCounterProvider({
    name: 'workflow_completions_total',
    help: 'Total number of completed workflows',
  }),
  makeCounterProvider({
    name: 'workflow_failures_total',
    help: 'Total number of failed workflows',
  }),
  makeCounterProvider({
    name: 'task_starts_total',
    help: 'Total number of started tasks',
  }),
  makeCounterProvider({
    name: 'task_failures_total',
    help: 'Total number of failed tasks',
  }),
  makeCounterProvider({
    name: 'task_retries_total',
    help: 'Total number of retried tasks',
  }),
  makeGaugeProvider({
    name: 'queue_depth',
    help: 'Current number of tasks in the queue',
  }),
  makeGaugeProvider({
    name: 'worker_count',
    help: 'Current number of active workers',
  }),
  makeHistogramProvider({
    name: 'workflow_duration_seconds',
    help: 'Duration of workflow execution in seconds',
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
  }),
  makeHistogramProvider({
    name: 'task_duration_seconds',
    help: 'Duration of task execution in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  }),
  makeHistogramProvider({
    name: 'task_queue_wait_seconds',
    help: 'Duration tasks wait in the queue before execution',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  }),
];

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
      path: '/metrics',
    }),
  ],
  providers: [ObservabilityService, ...metricProviders],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
