import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { TaskRun } from '../entities/task-run.entity';
import { TaskRunRepository } from './task-run.repository';
import { TaskRun as PrismaTaskRun, TaskRunStatus } from '@prisma/client';

@Injectable()
export class PrismaTaskRunRepository implements TaskRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(run: TaskRun): Promise<TaskRun> {
    const created = await this.prisma.taskRun.create({
      data: {
        id: run.id,
        workflowRunId: run.workflowRunId,
        taskDefinitionId: run.taskDefinitionId,
        status: run.status,
        input: run.input,
        output: run.output,
        error: run.error,
        queuedAt: run.queuedAt,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      },
    });
    return this.toDomain(created);
  }

  async findById(id: string): Promise<TaskRun | null> {
    const found = await this.prisma.taskRun.findUnique({
      where: { id },
    });
    if (!found) {
      return null;
    }
    return this.toDomain(found);
  }

  async findByWorkflowRunId(workflowRunId: string): Promise<TaskRun[]> {
    const found = await this.prisma.taskRun.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: 'asc' },
    });
    return found.map((f) => this.toDomain(f));
  }

  async update(id: string, partial: Partial<TaskRun>): Promise<TaskRun> {
    const updateData: any = {};
    if (partial.status !== undefined) updateData.status = partial.status;
    if (partial.input !== undefined) updateData.input = partial.input;
    if (partial.output !== undefined) updateData.output = partial.output;
    if (partial.error !== undefined) updateData.error = partial.error;
    if (partial.queuedAt !== undefined) updateData.queuedAt = partial.queuedAt;
    if (partial.startedAt !== undefined)
      updateData.startedAt = partial.startedAt;
    if (partial.completedAt !== undefined)
      updateData.completedAt = partial.completedAt;

    const updated = await this.prisma.taskRun.update({
      where: { id },
      data: updateData,
    });
    return this.toDomain(updated);
  }

  async atomicUpdateStatus(
    id: string,
    fromStatus: TaskRunStatus,
    toStatus: TaskRunStatus,
  ): Promise<boolean> {
    const result = await this.prisma.taskRun.updateMany({
      where: {
        id,
        status: fromStatus,
      },
      data: {
        status: toStatus,
      },
    });
    return result.count > 0;
  }

  private toDomain(prismaRun: PrismaTaskRun): TaskRun {
    return new TaskRun(
      prismaRun.id,
      prismaRun.workflowRunId,
      prismaRun.taskDefinitionId,
      prismaRun.status,
      prismaRun.input,
      prismaRun.output,
      prismaRun.error,
      prismaRun.queuedAt,
      prismaRun.startedAt,
      prismaRun.completedAt,
      prismaRun.createdAt,
      prismaRun.updatedAt,
    );
  }
}
