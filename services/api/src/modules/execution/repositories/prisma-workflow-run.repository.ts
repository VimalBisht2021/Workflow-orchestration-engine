import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { WorkflowRunRepository } from './workflow-run.repository';
import { TaskRun } from '../entities/task-run.entity';
import {
  WorkflowRun as PrismaWorkflowRun,
  TaskRun as PrismaTaskRun,
} from '@prisma/client';

@Injectable()
export class PrismaWorkflowRunRepository implements WorkflowRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(run: WorkflowRun): Promise<WorkflowRun> {
    const created = await this.prisma.workflowRun.create({
      data: {
        id: run.id,
        workflowId: run.workflowId,
        workflowVersion: run.workflowVersion,
        status: run.status,
        queuedAt: run.queuedAt,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        replayedFromId: run.replayedFromId ?? null,
      },
      include: {
        taskRuns: true,
      },
    });
    return this.toDomain(created);
  }

  async findById(id: string): Promise<WorkflowRun | null> {
    const found = await this.prisma.workflowRun.findUnique({
      where: { id },
      include: {
        taskRuns: true,
      },
    });
    if (!found) {
      return null;
    }
    return this.toDomain(found);
  }

  async update(
    id: string,
    partial: Partial<WorkflowRun>,
  ): Promise<WorkflowRun> {
    const updateData: any = {};
    if (partial.status !== undefined) updateData.status = partial.status;
    if (partial.queuedAt !== undefined) updateData.queuedAt = partial.queuedAt;
    if (partial.startedAt !== undefined)
      updateData.startedAt = partial.startedAt;
    if (partial.completedAt !== undefined)
      updateData.completedAt = partial.completedAt;

    const updated = await this.prisma.workflowRun.update({
      where: { id },
      data: updateData,
      include: {
        taskRuns: true,
      },
    });
    return this.toDomain(updated);
  }

  async findReplayChain(workflowRunId: string): Promise<WorkflowRun[]> {
    let currentId: string | null = workflowRunId;
    const maxDepth = 100; // Safety limit

    // Walk backward from the given run to the oldest ancestor
    const backwardChain: WorkflowRun[] = [];
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const run = await this.findById(currentId);
      if (!run) break;
      backwardChain.push(run);
      currentId = run.replayedFromId ?? null;
      depth++;
    }

    // Reverse to get oldest-first order
    return backwardChain.reverse();
  }

  private toDomain(
    prismaRun: PrismaWorkflowRun & { taskRuns?: PrismaTaskRun[] },
  ): WorkflowRun {
    const domainRun = new WorkflowRun(
      prismaRun.id,
      prismaRun.workflowId,
      prismaRun.workflowVersion,
      prismaRun.status,
      prismaRun.queuedAt,
      prismaRun.startedAt,
      prismaRun.completedAt,
      prismaRun.createdAt,
      prismaRun.updatedAt,
    );
    domainRun.replayedFromId = prismaRun.replayedFromId;

    if (prismaRun.taskRuns) {
      domainRun.taskRuns = prismaRun.taskRuns.map(
        (tr) =>
          new TaskRun(
            tr.id,
            tr.workflowRunId,
            tr.taskDefinitionId,
            tr.status,
            tr.input ?? undefined,
            tr.output ?? undefined,
            tr.error ?? null,
            tr.queuedAt,
            tr.startedAt,
            tr.completedAt,
            tr.createdAt,
            tr.updatedAt,
          ),
      );
    }

    return domainRun;
  }
}
