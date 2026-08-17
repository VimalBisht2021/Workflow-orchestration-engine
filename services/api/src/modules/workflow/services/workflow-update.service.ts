import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { TaskDefinition } from '../entities/task-definition.entity';
import {
  WORKFLOW_REPOSITORY,
  type WorkflowRepository,
} from '../repositories/workflow.repository';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';
import { BackoffStrategy } from '@prisma/client';

@Injectable()
export class WorkflowUpdateService {
  private readonly logger = new Logger(WorkflowUpdateService.name);

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowResponseDto> {
    const existing = await this.workflowRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Workflow with id ${id} not found`);
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.tags !== undefined) updateData.tags = dto.tags;

    // Reset status to draft on any update so it must be re-validated
    updateData.status = WorkflowStatus.DRAFT;

    if (dto.tasks) {
      updateData.tasks = dto.tasks.map(
        (t) =>
          new TaskDefinition(
            t.id,
            t.name,
            t.handler,
            t.dependencies || [],
            t.maxRetries || 0,
            t.retryDelayMs || 1000,
            t.backoffStrategy || BackoffStrategy.FIXED,
            t.configuration,
            t.timeoutMs,
          ),
      );
    }

    try {
      const updatedWorkflow = await this.workflowRepository.update(id, updateData);
      this.logger.log(`Workflow updated with id ${id}`);
      return {
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        description: updatedWorkflow.description,
        status: updatedWorkflow.status,
        owner: updatedWorkflow.owner,
        tags: updatedWorkflow.tags,
        version: updatedWorkflow.version,
        createdAt: updatedWorkflow.createdAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to update workflow ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
