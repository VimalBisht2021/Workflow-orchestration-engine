import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '../enums/workflow-status.enum';

export class WorkflowResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique identifier of the workflow',
  })
  id: string;

  @ApiProperty({
    example: 'Daily ETL Pipeline',
    description: 'The name of the workflow',
  })
  name: string;

  @ApiPropertyOptional({
    example: 'Extracts data from DB and loads to Data Warehouse',
    description: 'Optional description of the workflow',
  })
  description?: string;

  @ApiProperty({
    example: 'data-engineering-team',
    description: 'The owner or team responsible for the workflow',
  })
  owner: string;

  @ApiProperty({
    example: ['etl', 'daily'],
    description: 'Tags for filtering and organizing workflows',
  })
  tags: string[];

  @ApiProperty({
    example: 1,
    description: 'The current version of the workflow definition',
  })
  version: number;

  @ApiProperty({
    enum: WorkflowStatus,
    example: WorkflowStatus.DRAFT,
    description: 'The current status of the workflow',
  })
  status: WorkflowStatus;

  @ApiProperty({
    example: '2026-07-23T12:34:56.789Z',
    description: 'The timestamp when the workflow was created',
  })
  createdAt: string;
}
