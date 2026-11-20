import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { Workflow } from '../entities/workflow.entity';
import { TaskDefinition } from '../entities/task-definition.entity';
import {
  WORKFLOW_REPOSITORY,
  type WorkflowRepository,
} from '../repositories/workflow.repository';
import { WorkflowResponseDto } from '../dto/workflow-response.dto';
import { BackoffStrategy } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class WorkflowCreationService {
  private readonly logger = new Logger(WorkflowCreationService.name);

  constructor(
    @Inject(WORKFLOW_REPOSITORY)
    private readonly workflowRepository: WorkflowRepository,
    @Optional()
    private readonly prisma?: PrismaService,
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

    if (dto.tasks && dto.tasks.length > 0) {
      // Check if any incoming task ID already exists in the database
      const incomingIds = dto.tasks.map((t) => t.id).filter(Boolean);
      let existingSet = new Set<string>();
      if (this.prisma && incomingIds.length > 0) {
        try {
          const existing = await this.prisma.taskDefinition.findMany({
            where: { id: { in: incomingIds } },
            select: { id: true },
          });
          existingSet = new Set(existing.map((e) => e.id));
        } catch {
          existingSet = new Set();
        }
      }

      // Build task ID map to resolve collisions
      const taskIdMap = new Map<string, string>();
      for (const t of dto.tasks) {
        if (!t.id || existingSet.has(t.id)) {
          taskIdMap.set(t.id, uuid());
        } else {
          taskIdMap.set(t.id, t.id);
        }
      }

      for (const t of dto.tasks) {
        const newTaskId = taskIdMap.get(t.id) || t.id;
        const remappedDependencies = (t.dependencies || []).map(
          (depId) => taskIdMap.get(depId) || depId,
        );

        let remappedConfig = t.configuration;
        if (remappedConfig?.routes?.conditional) {
          const cond: Record<string, string> = { ...remappedConfig.routes.conditional };
          for (const [branch, target] of Object.entries(cond)) {
            cond[branch] = taskIdMap.get(target) || target;
          }
          remappedConfig = {
            ...remappedConfig,
            routes: { ...remappedConfig.routes, conditional: cond },
          };
        }

        let remappedInputMapping: Record<string, any> | undefined = undefined;
        const rawMapping = t.inputMapping || t.configuration?.inputMapping;
        if (rawMapping && typeof rawMapping === 'object') {
          remappedInputMapping = {};
          for (const [k, binding] of Object.entries(rawMapping)) {
            remappedInputMapping[k] = {
              ...(binding as any),
              sourceNodeId: taskIdMap.get((binding as any).sourceNodeId) || (binding as any).sourceNodeId,
            };
          }
          if (remappedConfig) {
            remappedConfig = {
              ...remappedConfig,
              inputMapping: remappedInputMapping,
            };
          }
        }

        workflow.addTask(
          new TaskDefinition(
            newTaskId,
            t.name,
            t.handler,
            remappedDependencies,
            t.maxRetries || 0,
            t.retryDelayMs || 1000,
            t.backoffStrategy || BackoffStrategy.FIXED,
            remappedConfig,
            t.timeoutMs,
            undefined,
            undefined,
            remappedInputMapping,
          ),
        );
      }
    }

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

  async fork(workflowId: string): Promise<WorkflowResponseDto> {
    const existing = await this.workflowRepository.findById(workflowId);
    if (!existing) {
      throw new NotFoundException(`Workflow with id ${workflowId} not found`);
    }

    const newId = uuid();
    const newVersion = (existing.version || 1) + 1;

    // Create unique task IDs for the new version while preserving dependency links
    const taskIdMap = new Map<string, string>();
    for (const t of existing.tasks) {
      taskIdMap.set(t.id, uuid());
    }

    const clonedWorkflow = new Workflow(
      newId,
      existing.name,
      existing.description,
      existing.owner,
      existing.tags ?? [],
      newVersion,
      WorkflowStatus.DRAFT,
      new Date(),
    );

    for (const t of existing.tasks) {
      const remappedDependencies = (t.dependencies || []).map(
        (depId) => taskIdMap.get(depId) || depId,
      );

      // Remap conditional routes if present
      let remappedConfig = t.configuration;
      if (remappedConfig?.routes?.conditional) {
        const cond: Record<string, string> = { ...remappedConfig.routes.conditional };
        for (const [branch, target] of Object.entries(cond)) {
          cond[branch] = taskIdMap.get(target) || target;
        }
        remappedConfig = {
          ...remappedConfig,
          routes: {
            ...remappedConfig.routes,
            conditional: cond,
          },
        };
      }

      // Remap inputMapping sourceNodeId to newly generated task definition IDs
      let remappedInputMapping: Record<string, any> | undefined = undefined;
      const rawMapping = t.inputMapping || t.configuration?.inputMapping;
      if (rawMapping && typeof rawMapping === 'object') {
        remappedInputMapping = {};
        for (const [k, binding] of Object.entries(rawMapping)) {
          remappedInputMapping[k] = {
            ...(binding as any),
            sourceNodeId: taskIdMap.get((binding as any).sourceNodeId) || (binding as any).sourceNodeId,
          };
        }
        if (remappedConfig) {
          remappedConfig = {
            ...remappedConfig,
            inputMapping: remappedInputMapping,
          };
        }
      }

      clonedWorkflow.addTask(
        new TaskDefinition(
          taskIdMap.get(t.id) || uuid(),
          t.name,
          t.handler,
          remappedDependencies,
          t.maxRetries || 0,
          t.retryDelayMs || 1000,
          t.backoffStrategy || BackoffStrategy.FIXED,
          remappedConfig,
          t.timeoutMs,
          undefined,
          undefined,
          remappedInputMapping,
        ),
      );
    }

    try {
      await this.workflowRepository.save(clonedWorkflow);
      this.logger.log(`Workflow ${workflowId} forked into new version ${newVersion} (${newId})`);
    } catch (error) {
      this.logger.error(
        `Failed to save forked workflow ${newId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    return {
      ...clonedWorkflow,
      createdAt: clonedWorkflow.createdAt.toISOString(),
    };
  }
}
