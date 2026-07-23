export class WorkflowValidationResponseDto {
  workflowId: string;

  valid: boolean;

  errors: string[];

  warnings: string[];

  validatedAt: string;
}
