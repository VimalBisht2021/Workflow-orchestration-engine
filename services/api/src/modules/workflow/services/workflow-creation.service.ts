import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { Workflow } from '../entities/workflow.entity';
import {
  WORKFLOW_REPOSITORY,
  type WorkflowRepository,
} from '../repositories/workflow.repository';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';

@Injectable()
export class WorkflowCreationService {
  private readonly logger = new Logger(WorkflowCreationService.name);

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async create(dto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
    const workflow = new Workflow(
      uuid(),
      dto.name,
      dto.description,
      dto.owner,
      dto.tags ?? [],
      1,
      WorkflowStatus.DRAFT,
      new Date(),
    );

    try {
      await this.workflowRepository.save(workflow);
      this.logger.log(`New workflow created with id ${workflow.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to save workflow ${workflow.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    return {
      ...workflow,
      createdAt: workflow.createdAt.toISOString(),
    };
  }
}
