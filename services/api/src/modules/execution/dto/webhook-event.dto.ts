import {
  IsString,
  IsEnum,
  IsDateString,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { WebhookEventType } from '@local/execution-contract';

export class WebhookEventPayloadDto {
  @IsString()
  @IsNotEmpty()
  taskRunId: string;

  @IsString()
  @IsNotEmpty()
  workflowRunId: string;

  @IsInt()
  workflowVersion: number;

  @IsString()
  @IsNotEmpty()
  correlationId: string;

  @IsOptional()
  output?: unknown;

  @IsOptional()
  error?: unknown;
}

export class WebhookEventDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  specVersion: string;

  @IsEnum(['TASK_STARTED', 'TASK_COMPLETED', 'TASK_FAILED', 'TASK_CANCELLED'])
  eventType: WebhookEventType;

  @IsDateString()
  occurredAt: string;

  @ValidateNested()
  @Type(() => WebhookEventPayloadDto)
  payload: WebhookEventPayloadDto;
}
