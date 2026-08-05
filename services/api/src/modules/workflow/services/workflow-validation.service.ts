import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  WORKFLOW_REPOSITORY,
  type WorkflowRepository,
} from '../repositories/workflow.repository';
import { WorkflowValidationResponseDto } from '../dto/workflow-validation-response.dto';
import { WorkflowAlreadyValidatedError } from '../exceptions/domain.exception';

@Injectable()
export class WorkflowValidationService {
  private readonly logger = new Logger(WorkflowValidationService.name);

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async validate(workflowId: string): Promise<WorkflowValidationResponseDto> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    try {
      workflow.validate();

      await this.workflowRepository.update(workflowId, {
        status: workflow.status,
      });
      this.logger.log(`Validation completed for workflow ${workflowId}`);
    } catch (error) {
      if (error instanceof WorkflowAlreadyValidatedError) {
        // Validation is idempotent if already validated
      } else {
        throw error;
      }
    }

    return {
      workflowId,
      valid: true,
      errors: [],
      warnings: [],
      validatedAt: new Date().toISOString(),
    };
  }
}
