import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import {
  WorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../repositories/workflow.repository';
import { WorkflowValidationResponseDto } from '../dto/workflow-validation-response.dto';

@Injectable()
export class WorkflowValidationService {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async validate(workflowId: string): Promise<WorkflowValidationResponseDto> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    if (workflow.status === WorkflowStatus.DRAFT) {
      await this.workflowRepository.update(workflowId, {
        status: WorkflowStatus.VALIDATED,
      });
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
