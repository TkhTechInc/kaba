/**
 * Sentry configuration for frontend (client-side)
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.npm_package_version || 'unknown',

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive localStorage keys
    if (event.contexts?.localStorage) {
      const localStorage = event.contexts.localStorage as Record<string, unknown>;
      delete localStorage['qb_auth_token'];
      delete localStorage['qb_auth_user'];
    }

    // Remove sensitive form data
    if (event.request?.data && typeof event.request.data === 'object') {
      const data = event.request.data as Record<string, unknown>;
      delete data['password'];
      delete data['otp'];
      delete data['phone'];
      delete data['email'];
    }

    return event;
  },

  // Ignore known errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded', // Benign browser warning
    'Non-Error promise rejection captured', // Handled by app
    'Network Error',                       // Network failures
    'Failed to fetch',
  ],
});
