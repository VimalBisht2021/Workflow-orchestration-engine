import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Workflow } from '../../workflow/entities/workflow.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';
import { TaskRun } from '../entities/task-run.entity';
import { WorkflowRunStatus, TaskRunStatus } from '@prisma/client';

@Injectable()
export class WorkflowRunFactory {
  create(workflow: Workflow): WorkflowRun {
    const runId = crypto.randomUUID();
    const now = new Date();

    const workflowRun = new WorkflowRun(
      runId,
      workflow.id,
      workflow.version,
      WorkflowRunStatus.PENDING,
      now, // queuedAt
      null,
      null,
      now,
      now,
    );

    // Instantiate TaskRuns for all TaskDefinitions
    const taskRuns = workflow.tasks.map((def) => {
      return new TaskRun(
        crypto.randomUUID(),
        runId,
        def.id,
        TaskRunStatus.PENDING,
        null, // Initial input - can be customized later
        null,
        null,
        null,
        null,
        null,
        now,
        now,
      );
    });

    workflowRun.taskRuns = taskRuns;

    return workflowRun;
  }
}
