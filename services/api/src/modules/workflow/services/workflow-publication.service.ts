import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  WORKFLOW_REPOSITORY,
  type WorkflowRepository,
} from '../repositories/workflow.repository';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';

@Injectable()
export class WorkflowPublicationService {
  private readonly logger = new Logger(WorkflowPublicationService.name);

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async publish(workflowId: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    workflow.publish();

    const updated = await this.workflowRepository.update(workflowId, {
      status: workflow.status,
    });
    this.logger.log(`Workflow published with id ${workflowId}`);

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
