import { ApiProperty } from '@nestjs/swagger';

export class WorkflowValidationResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the validated workflow',
  })
  workflowId: string;

  @ApiProperty({
    example: true,
    description: 'Indicates whether the workflow graph is valid',
  })
  valid: boolean;

  @ApiProperty({
    example: [],
    description: 'List of validation errors',
  })
  errors: string[];

  @ApiProperty({
    example: ['Task retry policy missing, using default'],
    description: 'List of validation warnings',
  })
  warnings: string[];

  @ApiProperty({
    example: '2026-07-23T12:34:56.789Z',
    description: 'Timestamp when the validation occurred',
  })
  validatedAt: string;
}
