// Custom error classes for domain-specific error handling

export class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Access forbidden', details?: unknown) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, 'BUSINESS_RULE_VIOLATION', 422, details);
  }
}

export class ExternalServiceError extends DomainError {
  constructor(service: string, message: string, details?: unknown) {
    super(`External service error (${service}): ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, details);
  }
}

export class DatabaseError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(`Database error: ${message}`, 'DATABASE_ERROR', 500, details);
  }
}

export class ConfigurationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(`Configuration error: ${message}`, 'CONFIGURATION_ERROR', 500, details);
  }
}

export class AIProviderError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(`AI provider error: ${message}`, 'AI_PROVIDER_ERROR', 503, details);
  }
}
