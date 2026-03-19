/**
 * Application-wide constants
 * All magic numbers should be defined here with clear rationale
 */

export const MCP_CONFIG = {
  // Maximum items to prevent OOM and timeouts
  MAX_QUERY_ITEMS: 10000, // DynamoDB best practice: paginate before hitting this
  MAX_BULK_INVOICES: 100, // Reasonable batch size for atomic operations
  MAX_INVOICE_LINE_ITEMS: 100,

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 1000,
} as const;

export const AI_CONFIG = {
  CASH_PREDICTION: {
    MAX_TOKENS: 500, // Enough for 5 recommendations (~100 tokens each)
    TEMPERATURE: 0.3, // Lower = more consistent, deterministic
    TIMEOUT_MS: 30000, // 30s max for AI call
    MAX_RETRIES: 2,
  },
  RECEIPT_EXTRACTION: {
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.1, // Very deterministic for structured data
    TIMEOUT_MS: 20000,
  },
  // Cost limits per tier per month
  COST_LIMITS: {
    starter: 5.0, // $5/month
    pro: 50.0, // $50/month
    enterprise: 500.0, // $500/month
  },
  // Token limits per tier per month
  TOKEN_LIMITS: {
    free: 50000, // ~50k tokens
    starter: 100000, // ~100k tokens
    pro: 1000000, // ~1M tokens
    enterprise: 10000000, // ~10M tokens
  },
} as const;

export const TAX_CONFIG = {
  // Default VAT rates by country
  DEFAULT_VAT_RATE: {
    BJ: 18, // Benin
    CI: 18, // Côte d'Ivoire
    TG: 18, // Togo
    BF: 18, // Burkina Faso
    GH: 12.5, // Ghana (VAT + NHIL)
    NG: 7.5, // Nigeria
    SN: 18, // Senegal
    ML: 18, // Mali
  } as Record<string, number>,

  // Fallback for unknown countries
  DEFAULT_RATE: 18,

  // Maximum period for tax reports (prevent abuse)
  MAX_REPORT_DAYS: 365,
} as const;

export const RECONCILIATION_CONFIG = {
  // Matching thresholds
  EXACT_MATCH_TOLERANCE: 0.01, // Within 1 cent = exact match
  PARTIAL_MATCH_THRESHOLD: 0.10, // Within 10% = partial match
  MIN_CONFIDENCE: 50, // Minimum confidence to suggest match

  // Performance limits
  MAX_ITEMS_TO_RECONCILE: 5000,
  BATCH_SIZE: 100,
} as const;

export const CASH_FLOW_CONFIG = {
  // Prediction parameters
  MIN_HISTORICAL_DAYS: 30, // Need at least 30 days of history
  DEFAULT_FORECAST_DAYS: 30,
  MAX_FORECAST_DAYS: 90,

  // Risk thresholds
  HIGH_RISK_THRESHOLD: 0, // Balance will go negative
  MEDIUM_RISK_THRESHOLD: 0.2, // Balance drops below 20% of current

  // Daily burn rate calculation
  ROLLING_AVERAGE_WINDOW: 30, // 30-day moving average
} as const;

export const NOTIFICATION_CONFIG = {
  // Message limits
  MAX_MESSAGE_LENGTH: 1600, // WhatsApp limit
  MAX_BULK_RECIPIENTS: 1000,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,

  // Rate limits (per business per day)
  DAILY_LIMITS: {
    daily_summary: 1,
    payment_reminder: 50,
    invoice_notification: 100,
  },
} as const;

export const LAMBDA_CONFIG = {
  // Timeout safety margins
  MAX_EXECUTION_TIME_MS: 540000, // 9 minutes (leave 1 min buffer for 10 min Lambda timeout)
  WARNING_THRESHOLD_MS: 480000, // 8 minutes - log warning if approaching timeout
} as const;

export const DYNAMODB_CONFIG = {
  // Scan/Query limits
  MAX_RESPONSE_SIZE_MB: 1, // DynamoDB returns max 1MB per query
  BATCH_WRITE_SIZE: 25, // DynamoDB max batch size
  TRANSACTION_LIMIT: 100, // DynamoDB max items per transaction
} as const;
