import { Injectable } from '@nestjs/common';
import { TaskRun } from '../entities/task-run.entity';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';

@Injectable()
export class DependencyResolver {
  /**
   * Evaluates the workflow state and returns a list of TaskRuns that are ready to execute.
   * A TaskRun is ready if:
   * 1. It is currently PENDING.
   * 2. All of its dependencies (based on TaskDefinition) have successfully COMPLETED.
   *
   * If any dependency is FAILED or SKIPPED, the task is considered blocked and will not be returned.
   * If a dependency is missing from the task runs entirely, it means the workflow definitions are mismatched.
   *
   * @param definitions All task definitions in the workflow version
   * @param runs All task runs currently instantiated for the workflow run
   */
  getReadyTasks(definitions: TaskDefinition[], runs: TaskRun[]): TaskRun[] {
    const readyTasks: TaskRun[] = [];

    // Create lookup maps for quick access
    const definitionMap = new Map(definitions.map((d) => [d.id, d]));
    const runMapByDefId = new Map(runs.map((r) => [r.taskDefinitionId, r]));

    for (const run of runs) {
      // Only consider tasks that haven't been scheduled or started yet.
      // We return PENDING tasks only.
      if (run.isPending()) {
        const def = definitionMap.get(run.taskDefinitionId);
        if (!def) {
          throw new Error(
            `TaskDefinition ${run.taskDefinitionId} missing for TaskRun ${run.id}`,
          );
        }

        let allDependenciesMet = true;
        for (const depId of def.dependencies) {
          const depRun = runMapByDefId.get(depId);
          if (!depRun) {
            // Dependency run doesn't exist. This shouldn't happen if factory initialized everything properly.
            allDependenciesMet = false;
            break;
          }
          if (!depRun.isCompleted()) {
            allDependenciesMet = false;
            break;
          }
        }

        if (allDependenciesMet) {
          readyTasks.push(run);
        }
      }
    }

    return readyTasks;
  }
}
