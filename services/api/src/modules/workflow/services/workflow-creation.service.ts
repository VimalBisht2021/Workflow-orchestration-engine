import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { Workflow } from '../entities/workflow.entity';
import {
  WorkflowRepository,
  WORKFLOW_REPOSITORY,
} from '../repositories/workflow.repository';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';

@Injectable()
export class WorkflowCreationService {
  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async create(dto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
    const workflow: Workflow = {
      id: uuid(),
      name: dto.name,
      description: dto.description,
      owner: dto.owner,
      tags: dto.tags ?? [],
      version: 1,
      status: WorkflowStatus.DRAFT,
      createdAt: new Date(),
    };

    await this.workflowRepository.save(workflow);

    return {
      ...workflow,
      createdAt: workflow.createdAt.toISOString(),
    };
  }
}
