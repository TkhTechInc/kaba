/**
 * Sentry error tracking integration for backend
 *
 * Captures:
 * - Unhandled exceptions
 * - Promise rejections
 * - HTTP errors from controllers
 * - Performance traces for critical operations
 */
let Sentry: {
  init: (opts: unknown) => void;
  withScope: (cb: (scope: unknown) => void) => void;
  captureException: (err: Error) => void;
  captureMessage: (msg: string, level?: string) => void;
  startSpan: (opts: unknown, cb: (span?: unknown) => unknown) => unknown;
  close: (timeout?: number) => Promise<boolean>;
  httpIntegration: () => unknown;
} | null = null;
let nodeProfilingIntegration: () => unknown = () => ({});

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/node');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const profiling = require('@sentry/profiling-node');
  nodeProfilingIntegration = profiling.nodeProfilingIntegration ?? (() => ({}));
} catch {
  console.log('[Sentry] Optional: @sentry/node not available, error tracking disabled');
}

let sentryInitialized = false;

export function initSentry() {
  if (sentryInitialized || !Sentry) return;

  const dsn = process.env['SENTRY_DSN'];
  if (!dsn || !dsn.trim()) {
    console.log('[Sentry] SENTRY_DSN not set, error tracking disabled');
    return;
  }

  const environment = process.env['NODE_ENV'] || 'development';
  const release = process.env['SENTRY_RELEASE'] || process.env['npm_package_version'] || 'unknown';

  Sentry.init({
    dsn,
    environment,
    release: `kaba-backend@${release}`,

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(),
    ],

    // Filter out sensitive data
    beforeSend(event: { request?: { headers?: Record<string, string>; data?: unknown } }, _hint: unknown) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }

      // Remove sensitive body fields
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>;
        delete data['password'];
        delete data['passwordHash'];
        delete data['otp'];
        delete data['token'];
      }

      return event;
    },

    // Ignore known/expected errors
    ignoreErrors: [
      'ConditionalCheckFailedException', // DynamoDB race conditions
      'TransactionCanceledException',   // DynamoDB transaction conflicts
      'ResourceNotFoundException',      // Expected when item not found
      'ECONNREFUSED',                  // Network errors
      'ETIMEDOUT',
      'ENOTFOUND',
    ],
  });

  sentryInitialized = true;
  console.log(`[Sentry] Initialized for ${environment} (release: ${release})`);
}

/**
 * Capture exception to Sentry with additional context
 */
export function captureException(error: Error | unknown, context?: {
  userId?: string;
  businessId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!sentryInitialized || !Sentry) return;

  Sentry!.withScope((scope: unknown) => {
    const s = scope as { setUser: (u: unknown) => void; setTag: (k: string, v: string) => void; setContext: (k: string, v: unknown) => void };
    if (context?.userId) s.setUser({ id: context.userId });
    if (context?.businessId) s.setTag('businessId', context.businessId);
    if (context?.operation) s.setTag('operation', context.operation);
    if (context?.metadata) s.setContext('metadata', context.metadata);
    if (error instanceof Error) Sentry!.captureException(error);
    else Sentry!.captureException(new Error(String(error)));
  });
}

/**
 * Capture message to Sentry (non-error events)
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' | 'debug' = 'info') {
  if (!sentryInitialized || !Sentry) return;
  Sentry.captureMessage(message, level);
}

/**
 * Start a performance trace
 */
export function startTrace(name: string, op: string) {
  if (!sentryInitialized || !Sentry) return null;

  return Sentry.startSpan({ name, op }, (span?: unknown) => {
    const s = span as { setAttribute: (k: string, v: string) => void } | undefined;
    return {
      setTag: (key: string, value: string) => s?.setAttribute(key, value),
      setData: (key: string, value: unknown) => s?.setAttribute(key, String(value)),
      finish: () => {},
    };
  });
}

/**
 * Flush Sentry events (useful before Lambda shutdown)
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  if (!sentryInitialized || !Sentry) return true;
  return Sentry.close(timeout);
}
