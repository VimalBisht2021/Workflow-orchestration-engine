/**
 * WorkflowDefinitionDTO — the wire/transport format for WorkflowDefinition.
 *
 * This is what Export produces and Import consumes.
 * Identical structure to WorkflowDefinition but explicitly versioned
 * for schema evolution.
 */

import type { TaskDefinition, WorkflowDefinition } from './workflow-definition';

export interface WorkflowDefinitionDTO {
    /** Schema version of this DTO format. Enables future migrations. */
    schemaVersion: number;

    /** Unique workflow identifier. */
    id: string;

    /** Human-readable workflow name. */
    name: string;

    /** Semantic version of this workflow definition. */
    version: string;

    /** The task ID where execution begins. */
    entryTaskId: string;

    /** Tasks in this workflow. */
    tasks: TaskDefinition[];

    /** Optional metadata including canvas layout. */
    metadata?: WorkflowDefinition['metadata'];
}

/** Current schema version. Increment on breaking DTO changes. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Converts a WorkflowDefinition to its transport DTO.
 */
export function toDTO(definition: WorkflowDefinition): WorkflowDefinitionDTO {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: definition.id,
        name: definition.name,
        version: definition.version,
        entryTaskId: definition.entryTaskId,
        tasks: definition.tasks,
        metadata: definition.metadata,
    };
}

/**
 * Converts a transport DTO back to a WorkflowDefinition.
 * Handles schema version migration if needed.
 */
export function fromDTO(dto: WorkflowDefinitionDTO): WorkflowDefinition {
    if (dto.schemaVersion > CURRENT_SCHEMA_VERSION) {
        throw new Error(
            `DTO schema version ${dto.schemaVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}. Please update your builder.`
        );
    }

    // Future: Add migration logic for older schema versions here.
    // if (dto.schemaVersion === 0) { dto = migrateV0ToV1(dto); }

    return {
        id: dto.id,
        name: dto.name,
        version: dto.version,
        entryTaskId: dto.entryTaskId,
        tasks: dto.tasks,
        metadata: dto.metadata,
    };
}
