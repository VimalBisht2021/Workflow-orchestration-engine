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
   * 3. If a dependency is a condition handler, the condition's output.branch must match
   *    the edge label connecting them (i.e., this task must be on the "taken" branch).
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
            allDependenciesMet = false;
            break;
          }
          if (!depRun.isCompleted()) {
            allDependenciesMet = false;
            break;
          }

          // Check conditional routing: if the dependency is a condition handler,
          // verify this task is on the branch that was actually taken.
          const depDef = definitionMap.get(depId);
          if (depDef && depDef.handler === 'core/condition') {
            const condOutput = depRun.output as any;
            const takenBranch = condOutput?.branch; // 'true' or 'false'

            if (takenBranch) {
              // Check if this task is reachable via the taken branch
              const routes = depDef.configuration?.routes;
              if (routes?.conditional) {
                const conditionalRoutes = routes.conditional as Record<string, string>;
                const taskOnTakenBranch = conditionalRoutes[takenBranch];
                const taskOnOtherBranch = conditionalRoutes[takenBranch === 'true' ? 'false' : 'true'];

                // If this task is on the OTHER branch, it should not run
                if (taskOnOtherBranch === run.taskDefinitionId && taskOnTakenBranch !== run.taskDefinitionId) {
                  allDependenciesMet = false;
                  break;
                }
              }
            }
          }
        }

        if (allDependenciesMet) {
          readyTasks.push(run);
        }
      }
    }

    return readyTasks;
  }

  /**
   * Returns task runs that should be SKIPPED because they are on the wrong
   * branch of a completed condition task.
   */
  getSkippableTasks(definitions: TaskDefinition[], runs: TaskRun[]): TaskRun[] {
    const skippable: TaskRun[] = [];
    const definitionMap = new Map(definitions.map((d) => [d.id, d]));
    const runMapByDefId = new Map(runs.map((r) => [r.taskDefinitionId, r]));

    for (const run of runs) {
      if (!run.isPending()) continue;

      const def = definitionMap.get(run.taskDefinitionId);
      if (!def) continue;

      for (const depId of def.dependencies) {
        const depRun = runMapByDefId.get(depId);
        const depDef = definitionMap.get(depId);

        if (!depRun || !depDef) continue;
        if (depDef.handler !== 'core/condition') continue;
        if (!depRun.isCompleted()) continue;

        const condOutput = depRun.output as any;
        const takenBranch = condOutput?.branch;
        if (!takenBranch) continue;

        const routes = depDef.configuration?.routes;
        if (!routes?.conditional) continue;

        const conditionalRoutes = routes.conditional as Record<string, string>;
        const otherBranch = takenBranch === 'true' ? 'false' : 'true';
        const taskOnOtherBranch = conditionalRoutes[otherBranch];

        if (taskOnOtherBranch === run.taskDefinitionId) {
          skippable.push(run);
          break;
        }
      }
    }

    return skippable;
  }
}

