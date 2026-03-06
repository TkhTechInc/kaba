/**
 * Lightweight structured JSON logger for Lambda/CloudWatch.
 *
 * Outputs one JSON line per call with: level, message, timestamp, service, context, and any
 * extra metadata. CloudWatch Logs Insights can then filter/group on these fields directly.
 *
 * No external dependencies — uses console.* so Lambda's stdout capture works correctly.
 */

export interface LogContext {
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const service = process.env['SERVICE_NAME'] || 'kaba-backend';

/** Minimum level to emit. Set LOG_LEVEL env var in Lambda config or locally. */
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel: number = LEVELS[(process.env['LOG_LEVEL'] as LogLevel) ?? 'info'] ?? LEVELS.info;

function emit(level: LogLevel, context: string, msg: string, meta?: LogContext): void {
  if (LEVELS[level] < minLevel) return;

  const entry: Record<string, unknown> = {
    level,
    message: msg,
    timestamp: new Date().toISOString(),
    service,
    context,
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Create a scoped logger bound to a module/class name.
 *
 * @example
 *   const log = createLogger('AuthService');
 *   log.info('User logged in', { userId });
 *   log.error('Token validation failed', { reason });
 */
export function createLogger(context: string) {
  return {
    debug: (msg: string, meta?: LogContext) => emit('debug', context, msg, meta),
    info:  (msg: string, meta?: LogContext) => emit('info',  context, msg, meta),
    log:   (msg: string, meta?: LogContext) => emit('info',  context, msg, meta),
    warn:  (msg: string, meta?: LogContext) => emit('warn',  context, msg, meta),
    error: (msg: string, meta?: LogContext) => emit('error', context, msg, meta),
  };
}

/**
 * Module-level default logger (no context name).
 * Retained for backward compatibility with existing `import { logger } from ...` call sites.
 */
export const logger = createLogger('app');
