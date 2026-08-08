/**
 * WorkflowDefinition — the canonical domain model emitted by the Visual Builder
 * and consumed by the CompilationService.
 *
 * This is the public contract between Layer 1 (Builder/SDK/Importer) and
 * Layer 2 (Compiler). It must be JSON-serializable by default.
 *
 * Rules:
 *   - No Maps. Arrays only.
 *   - No internal runtime types.
 *   - No compiler types.
 *   - JSON-native transport.
 */

export interface TaskDefinition {
    /** Stable, immutable identifier (UUIDv7 recommended). */
    id: string;

    /** Plugin reference (e.g. 'core/http', 'core/condition'). */
    pluginId: string;

    /** Human-readable label. */
    name: string;

    /** Plugin-specific configuration. Driven by PluginManifest.configSchema. */
    config: Record<string, any>;

    /** Routing to downstream tasks. */
    routes: {
        /** Default next task ID for linear flow. */
        default?: string;
        /** Conditional routes keyed by outcome (e.g. "true"/"false"). */
        conditional?: Record<string, string>;
    };
}

export interface WorkflowDefinition {
    /** Unique workflow identifier. */
    id: string;

    /** Human-readable workflow name. */
    name: string;

    /** Semantic version of this workflow definition. */
    version: string;

    /** The task ID where execution begins. Explicit, not discovered. */
    entryTaskId: string;

    /** Ordered list of tasks in this workflow. */
    tasks: TaskDefinition[];

    /** Optional metadata. Runtime ignores it; Builder/SDK may use it. */
    metadata?: {
        /** Canvas layout positions — consumed by Builder, ignored by Runtime. */
        layout?: {
            nodePositions: Record<string, { x: number; y: number }>;
        };
        /** Arbitrary extension metadata. */
        [key: string]: any;
    };
}
