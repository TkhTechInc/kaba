import { DomainError, QuotaExceededError, ValidationError } from '@/shared/errors/DomainError';

/**
 * Thrown when a bulk operation fails and needs rollback
 */
export class BulkOperationError extends DomainError {
  constructor(
    message: string,
    public readonly succeeded: number,
    public readonly failed: number,
    public readonly errors: Array<{ index: number; error: string }>,
  ) {
    super(`BULK_OPERATION_FAILED: ${message}`, { succeeded, failed, errors });
    this.name = 'BulkOperationError';
  }
}

/**
 * Thrown when a query would return too many results
 */
export class QueryTooLargeError extends ValidationError {
  constructor(
    public readonly itemCount: number,
    public readonly maxItems: number,
    suggestion?: string,
  ) {
    super(`Query would return ${itemCount} items, exceeding limit of ${maxItems}. ${suggestion || 'Please narrow your date range.'}`);
    this.name = 'QueryTooLargeError';
  }
}

/**
 * Thrown when AI token/cost quota is exceeded
 */
export class AIQuotaExceededError extends QuotaExceededError {
  constructor(
    public readonly used: number,
    public readonly limit: number,
    public readonly tier: string,
  ) {
    super(
      `ai_tokens`,
      used,
      limit,
      `AI quota exceeded for tier ${tier}. Upgrade to increase limits.`,
    );
    this.name = 'AIQuotaExceededError';
  }
}

/**
 * Thrown when reconciliation detects concurrent modifications
 */
export class ConcurrentModificationError extends DomainError {
  constructor(
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly expectedVersion?: number,
    public readonly actualVersion?: number,
  ) {
    super(
      `CONCURRENT_MODIFICATION: ${resourceType} ${resourceId} was modified by another process`,
      { expectedVersion, actualVersion },
    );
    this.name = 'ConcurrentModificationError';
  }
}

/**
 * Thrown when date range validation fails
 */
export class InvalidDateRangeError extends ValidationError {
  constructor(
    public readonly startDate: string,
    public readonly endDate: string,
    public readonly reason: string,
  ) {
    super(`Invalid date range ${startDate} to ${endDate}: ${reason}`);
    this.name = 'InvalidDateRangeError';
  }
}

/**
 * Thrown when MCP tool input validation fails
 */
export class McpInputValidationError extends ValidationError {
  constructor(
    public readonly tool: string,
    public readonly errors: Array<{ field: string; message: string }>,
  ) {
    super(`Invalid input for ${tool}: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
    this.name = 'McpInputValidationError';
  }
}
