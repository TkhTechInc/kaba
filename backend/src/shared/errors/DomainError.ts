/**
 * Re-exports from @tkhtechinc/domain-errors.
 * All existing import paths across Kaba continue to work unchanged.
 * Source of truth is now the shared platform package.
 */
export {
  DomainError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BusinessRuleError,
  ExternalServiceError,
  DatabaseError,
  ConfigurationError,
  AIProviderError,
  // Additional classes available from the package (not yet used in Kaba):
  PaymentError,
  PaymentGatewayError,
  EventCapacityError,
  BookingError,
  QuotaExceededError,
  UnsupportedOperationError,
  OAuthNoAccountError,
  ErrorFactory,
  logDomainError,
  ERROR_STATUS_MAP,
} from '@tkhtechinc/domain-errors';
