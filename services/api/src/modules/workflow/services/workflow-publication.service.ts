import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import {
  WorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../repositories/workflow.repository';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';

@Injectable()
export class WorkflowPublicationService {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async publish(workflowId: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    if (workflow.status === WorkflowStatus.PUBLISHED) {
      throw new BadRequestException('Workflow is already published');
    }

    if (workflow.status !== WorkflowStatus.VALIDATED) {
      throw new BadRequestException(
        'Workflow must be validated before publishing',
      );
    }

    const updated = await this.workflowRepository.update(workflowId, {
      status: WorkflowStatus.PUBLISHED,
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
