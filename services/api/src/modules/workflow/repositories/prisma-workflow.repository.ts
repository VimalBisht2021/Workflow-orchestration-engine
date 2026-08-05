import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { Workflow } from '../entities/workflow.entity';
import { WorkflowRepository } from './workflow.repository';
import {
  WorkflowStatus as PrismaWorkflowStatus,
  Workflow as PrismaWorkflow,
  TaskDefinition as PrismaTaskDefinition,
  BackoffStrategy as PrismaBackoffStrategy,
} from '@prisma/client';
import { WorkflowStatus } from '../enums/workflow-status.enum';
import { TaskDefinition } from '../entities/task-definition.entity';
import { BackoffStrategy } from '@prisma/client';

@Injectable()
export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(
    prismaWorkflow: PrismaWorkflow & {
      taskDefinitions?: PrismaTaskDefinition[];
    },
  ): Workflow {
    const workflow = new Workflow(
      prismaWorkflow.id,
      prismaWorkflow.name,
      prismaWorkflow.description ?? undefined,
      prismaWorkflow.owner,
      prismaWorkflow.tags,
      prismaWorkflow.version,
      prismaWorkflow.status as unknown as WorkflowStatus,
      prismaWorkflow.createdAt,
    );

    if (prismaWorkflow.taskDefinitions) {
      workflow.tasks = prismaWorkflow.taskDefinitions.map(
        (t) =>
          new TaskDefinition(
            t.id,
            t.name,
            t.handler,
            t.dependencies,
            t.maxRetries,
            t.retryDelayMs,
            t.backoffStrategy,
            t.configuration,
            t.timeoutMs ?? undefined,
            t.createdAt,
            t.updatedAt,
          ),
      );
    }

    return workflow;
  }

  private toPersistence(workflow: Partial<Workflow>): any {
    const data: any = { ...workflow };
    if (data.description === undefined && 'description' in data) {
      data.description = null;
    }
    if (data.status) {
      data.status = data.status;
    }

    if (data.tasks) {
      data.taskDefinitions = {
        create: data.tasks.map((t: TaskDefinition) => ({
          id: t.id,
          name: t.name,
          handler: t.handler,
          dependencies: t.dependencies,
          maxRetries: t.maxRetries,
          retryDelayMs: t.retryDelayMs,
          backoffStrategy: t.backoffStrategy,
          configuration: t.configuration || undefined,
          timeoutMs: t.timeoutMs || null,
        })),
      };
      delete data.tasks;
    }

    return data;
  }

  async save(workflow: Workflow): Promise<Workflow> {
    const created = await this.prisma.workflow.create({
      data: this.toPersistence(workflow),
      include: { taskDefinitions: true },
    });
    return this.toDomain(created);
  }

  async findById(id: string): Promise<Workflow | null> {
    const found = await this.prisma.workflow.findUnique({
      where: { id },
      include: { taskDefinitions: true },
    });
    if (!found) {
      return null;
    }
    return this.toDomain(found);
  }

  async update(id: string, partial: Partial<Workflow>): Promise<Workflow> {
    const data = this.toPersistence(partial);
    // If tasks are being updated, we probably need a more complex update strategy
    // like deleting old ones and creating new ones. Since this is an MVP,
    // replacing the graph entirely if 'tasks' is provided is easiest:
    if (data.taskDefinitions) {
      await this.prisma.taskDefinition.deleteMany({
        where: { workflowId: id },
      });
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data,
      include: { taskDefinitions: true },
    });
    return this.toDomain(updated);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.workflow.delete({
        where: { id },
      });
      return true;
    } catch (_) {
      return false;
    }
  }
}
