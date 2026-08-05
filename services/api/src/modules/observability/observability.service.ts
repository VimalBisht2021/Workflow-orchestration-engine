import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';
import { trace, Span, Tracer, SpanStatusCode } from '@opentelemetry/api';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ObservabilityService {
  private tracer: Tracer;

  constructor(
    private readonly logger: PinoLogger,
    @InjectMetric('workflow_starts_total')
    private readonly workflowStartsCounter: Counter<string>,
    @InjectMetric('workflow_completions_total')
    private readonly workflowCompletionsCounter: Counter<string>,
    @InjectMetric('workflow_failures_total')
    private readonly workflowFailuresCounter: Counter<string>,
    @InjectMetric('task_starts_total')
    private readonly taskStartsCounter: Counter<string>,
    @InjectMetric('task_failures_total')
    private readonly taskFailuresCounter: Counter<string>,
    @InjectMetric('task_retries_total')
    private readonly taskRetriesCounter: Counter<string>,
    @InjectMetric('queue_depth')
    private readonly queueDepthGauge: Gauge<string>,
    @InjectMetric('worker_count')
    private readonly workerCountGauge: Gauge<string>,
    @InjectMetric('workflow_duration_seconds')
    private readonly workflowDurationHistogram: Histogram<string>,
    @InjectMetric('task_duration_seconds')
    private readonly taskDurationHistogram: Histogram<string>,
    @InjectMetric('task_queue_wait_seconds')
    private readonly taskQueueWaitHistogram: Histogram<string>,
  ) {
    this.logger.setContext(ObservabilityService.name);
    this.tracer = trace.getTracer('workflow-orchestration-engine');
  }

  // --- Metrics ---

  recordWorkflowStart() {
    this.workflowStartsCounter.inc();
  }

  recordWorkflowCompletion(durationSeconds: number) {
    this.workflowCompletionsCounter.inc();
    this.workflowDurationHistogram.observe(durationSeconds);
  }

  recordWorkflowFailure(durationSeconds: number) {
    this.workflowFailuresCounter.inc();
    this.workflowDurationHistogram.observe(durationSeconds);
  }

  recordTaskStart(queueWaitSeconds: number) {
    this.taskStartsCounter.inc();
    this.taskQueueWaitHistogram.observe(queueWaitSeconds);
  }

  recordTaskCompletion(durationSeconds: number) {
    this.taskDurationHistogram.observe(durationSeconds);
  }

  recordTaskFailure(durationSeconds: number) {
    this.taskFailuresCounter.inc();
    this.taskDurationHistogram.observe(durationSeconds);
  }

  recordTaskRetry() {
    this.taskRetriesCounter.inc();
  }

  setQueueDepth(depth: number) {
    this.queueDepthGauge.set(depth);
  }

  setWorkerCount(count: number) {
    this.workerCountGauge.set(count);
  }

  // --- Tracing ---

  startSpan(name: string, attributes?: Record<string, any>): Span {
    return this.tracer.startSpan(name, { attributes });
  }

  recordException(span: Span, error: Error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }

  // --- Logging ---

  debug(message: string, contextObj?: object) {
    this.logger.debug(contextObj || {}, message);
  }

  info(message: string, contextObj?: object) {
    this.logger.info(contextObj || {}, message);
  }

  warn(message: string, contextObj?: object) {
    this.logger.warn(contextObj || {}, message);
  }

  error(message: string, error?: Error, contextObj?: object) {
    this.logger.error({ err: error, ...contextObj }, message);
  }

  fatal(message: string, error?: Error, contextObj?: object) {
    this.logger.fatal({ err: error, ...contextObj }, message);
  }
}
