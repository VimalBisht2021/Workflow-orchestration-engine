import { Injectable, Logger } from '@nestjs/common';
import { TaskDefinition } from '../../workflow/entities/task-definition.entity';
import { TaskRun } from '../entities/task-run.entity';
import { WorkflowRun } from '../entities/workflow-run.entity';

export type InputBinding = {
  sourceNodeId: string;
  path: string[];
};

export type InputMapping = Record<string, InputBinding>;

export class InputMappingResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputMappingResolutionError';
  }
}

const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Returns all ancestor task IDs for a given task ID by traversing predecessor dependencies.
 */
export function getAncestorIds(
  taskId: string,
  definitionMap: Map<string, TaskDefinition>,
): Set<string> {
  const ancestors = new Set<string>();
  const queue = [...(definitionMap.get(taskId)?.dependencies || [])];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (!ancestors.has(currentId)) {
      ancestors.add(currentId);
      const parentDef = definitionMap.get(currentId);
      if (parentDef?.dependencies) {
        for (const dep of parentDef.dependencies) {
          if (!ancestors.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }
  }

  return ancestors;
}

@Injectable()
export class InputMappingResolverService {
  private readonly logger = new Logger(InputMappingResolverService.name);

  /**
   * Resolves declared input mappings for a task immediately before dispatch to DTP.
   *
   * @param taskDef The definition of the task being dispatched.
   * @param taskRun The current TaskRun.
   * @param workflowRun The parent WorkflowRun.
   * @param definitionMap Lookup of all TaskDefinitions in this workflow version.
   * @param runMapByDefId Lookup of instantiated TaskRuns keyed by taskDefinitionId.
   * @returns Dictionary of resolved input values to merge into the task's input payload.
   */
  resolve(
    taskDef: TaskDefinition,
    taskRun: TaskRun,
    workflowRun: WorkflowRun,
    definitionMap: Map<string, TaskDefinition>,
    runMapByDefId: Map<string, TaskRun>,
  ): Record<string, any> {
    const inputMapping = taskDef.inputMapping || taskDef.configuration?.inputMapping;
    if (!inputMapping || Object.keys(inputMapping).length === 0) {
      return {};
    }

    const resolved: Record<string, any> = {};
    const ancestors = getAncestorIds(taskDef.id, definitionMap);

    for (const [targetKey, rawBinding] of Object.entries(inputMapping)) {
      if (!rawBinding || typeof rawBinding !== 'object') {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' has invalid binding definition in task '${taskDef.id}'.`,
        );
      }

      const binding = rawBinding as Partial<InputBinding>;
      const { sourceNodeId, path } = binding;

      if (!sourceNodeId || typeof sourceNodeId !== 'string') {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' is missing valid 'sourceNodeId' in task '${taskDef.id}'.`,
        );
      }

      if (!Array.isArray(path) || path.length === 0) {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' specifies empty or non-array path in task '${taskDef.id}'.`,
        );
      }

      // 1. Verify source node is a valid declared dependency or ancestor
      if (!ancestors.has(sourceNodeId)) {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' references source node '${sourceNodeId}', which is not a declared dependency or ancestor of task '${taskDef.id}'.`,
        );
      }

      // 2. Find specified upstream TaskRun
      const sourceRun = runMapByDefId.get(sourceNodeId);
      if (!sourceRun) {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' references source node '${sourceNodeId}' which has no TaskRun in workflow run ${workflowRun.id}.`,
        );
      }

      // 3. Verify source node completed successfully and its output is available
      if (sourceRun.status !== 'COMPLETED') {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' requires output from source node '${sourceNodeId}', but source task is currently in '${sourceRun.status}' status.`,
        );
      }

      if (sourceRun.output === undefined || sourceRun.output === null) {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' requires output from source node '${sourceNodeId}', but source output is null or undefined.`,
        );
      }

      // 4. Safe own-property path traversal
      let current: any = sourceRun.output;
      for (let i = 0; i < path.length; i++) {
        const segment = String(path[i]);

        // Security: reject prototype pollution
        if (FORBIDDEN_PROPERTIES.has(segment)) {
          throw new InputMappingResolutionError(
            `Target input '${targetKey}' references unsafe property '${segment}' in path [${path.join(', ')}].`,
          );
        }

        if (current === null || current === undefined) {
          throw new InputMappingResolutionError(
            `Target input '${targetKey}' failed resolving path [${path.join(', ')}]: cannot read property '${segment}' from null/undefined.`,
          );
        }

        if (Array.isArray(current)) {
          const index = Number(segment);
          if (isNaN(index) || !Number.isInteger(index) || index < 0 || index >= current.length) {
            throw new InputMappingResolutionError(
              `Target input '${targetKey}' failed resolving path [${path.join(', ')}]: invalid array index '${segment}' for array of length ${current.length}.`,
            );
          }
          current = current[index];
        } else if (typeof current === 'object') {
          if (!Object.prototype.hasOwnProperty.call(current, segment)) {
            throw new InputMappingResolutionError(
              `Target input '${targetKey}' failed resolving path [${path.join(', ')}]: property '${segment}' does not exist on source output.`,
            );
          }
          current = current[segment];
        } else {
          throw new InputMappingResolutionError(
            `Target input '${targetKey}' failed resolving path [${path.join(', ')}]: cannot read property '${segment}' on primitive ${typeof current}.`,
          );
        }
      }

      // 5. Ensure JSON-compatible value
      try {
        resolved[targetKey] = JSON.parse(JSON.stringify(current));
      } catch (err: any) {
        throw new InputMappingResolutionError(
          `Target input '${targetKey}' resolved to non-JSON-serializable value: ${err.message}`,
        );
      }
    }

    this.logger.debug(
      `Resolved ${Object.keys(resolved).length} mapped inputs for task ${taskDef.id} (Run: ${taskRun.id})`,
    );

    return resolved;
  }
}
