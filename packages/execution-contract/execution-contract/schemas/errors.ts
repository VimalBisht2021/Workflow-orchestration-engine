/**
 * Standardized execution error categories for all integration tasks.
 */
export enum ErrorCategory {
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    DNS_FAILURE = 'DNS_FAILURE',
    AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
    RATE_LIMITED = 'RATE_LIMITED',
    HTTP_404 = 'HTTP_404',
    HTTP_500 = 'HTTP_500',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class HandlerExecutionError extends Error {
    constructor(
        public readonly category: ErrorCategory,
        message: string,
        public readonly details?: Record<string, any>
    ) {
        super(message);
        this.name = 'HandlerExecutionError';
    }
}
