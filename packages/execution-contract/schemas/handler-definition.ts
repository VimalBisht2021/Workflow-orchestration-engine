export type HandlerCategory = 'trigger' | 'core' | 'integration' | 'utility' | 'script' | 'internal' | 'experimental';

export enum HandlerMaturity {
    EXPERIMENTAL = 'EXPERIMENTAL',
    BETA = 'BETA',
    STABLE = 'STABLE',
    DEPRECATED = 'DEPRECATED'
}

export interface JsonSchema {
    $schema?: string;
    type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
    properties?: Record<string, JsonSchema>;
    required?: string[];
    description?: string;
    examples?: any[];
    [key: string]: any;
}

export interface HandlerDefinition {
    id: string; // e.g., 'http'
    version: string; // e.g., '1' -> effectively immutable identifier http@1
    
    displayName: string;
    description: string;
    category: HandlerCategory;
    maturity: HandlerMaturity;
    
    inputSchema: JsonSchema;
    outputSchema: JsonSchema;
    configurationSchema: JsonSchema;
    
    capabilities: {
        execution: {
            retry: boolean;
            timeout: boolean;
            cancellation: boolean;
            replay: boolean;
            compensation: boolean;
            scheduling: boolean;
        };
        network: {
            http: boolean;
            streaming: boolean;
        };
        security: {
            sandbox: boolean;
        };
    };
    
    estimatedExecutionType: 'FAST' | 'LONG_RUNNING';
    
    icon?: string;
    tags: string[];
}

export interface SchedulingDirective {
    wakeUpAt?: Date;
    delayMs?: number;
    cron?: string;
}

export interface RoutingDirective {
    branch: string; // The ID of the next node/branch to traverse
}

export interface ExecutionResult<T = any> {
    status: 'COMPLETED' | 'FAILED' | 'WAITING';
    output?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    directive?: SchedulingDirective;
    routing?: RoutingDirective;
    metrics?: {
        durationMs: number;
        [key: string]: any;
    };
}
