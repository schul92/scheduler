/**
 * Sentry Error Tracking
 *
 * Centralized error tracking and reporting for production monitoring.
 * Note: Sentry native plugin was removed from app.json due to build issues.
 * This module gracefully handles the case where native modules are unavailable.
 */

// Track if Sentry is available (native modules may not be linked)
let SentryModule: typeof import('@sentry/react-native') | null = null;
let sentryInitialized = false;

// Try to import Sentry - it may fail if native modules aren't linked
try {
  SentryModule = require('@sentry/react-native');
} catch (error) {
  console.warn('[Sentry] Native module not available - error tracking disabled');
}

/**
 * Initialize Sentry error tracking
 * Call this at app startup in _layout.tsx
 */
export function initSentry() {
  if (!SentryModule) {
    console.warn('[Sentry] Cannot initialize - native module not available');
    return;
  }

  if (sentryInitialized) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.warn('[Sentry] No DSN configured - error tracking disabled');
    return;
  }

  try {
    SentryModule.init({
      dsn,
      environment: __DEV__ ? 'development' : 'production',
      // Only send 20% of transactions in production for performance monitoring
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      // Attach stack traces to all messages
      attachStacktrace: true,
      // Track user sessions
      enableAutoSessionTracking: true,
      // Don't send in development by default
      enabled: !__DEV__,
      // Capture unhandled promise rejections
      enableNativeNagger: false,
      // Breadcrumb configuration
      maxBreadcrumbs: 50,
      // Before send hook for filtering
      beforeSend(event) {
        // Don't send events in development
        if (__DEV__) {
          console.log('[Sentry] Would send event:', event.message || event.exception);
          return null;
        }
        return event;
      },
    });
    sentryInitialized = true;
    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error instanceof Error ? error.message : error);
  }
}

/**
 * Capture an error and send to Sentry
 * @param error - The error to capture
 * @param context - Additional context about where/why the error occurred
 */
export function captureError(error: Error | unknown, context?: Record<string, any>) {
  const err = error instanceof Error ? error : new Error(String(error));

  if (__DEV__) {
    console.error('[Sentry] Captured error:', err.message, context);
    return;
  }

  if (!SentryModule || !sentryInitialized) return;

  SentryModule.captureException(err, {
    extra: context,
  });
}

/**
 * Capture a message (non-error event)
 * @param message - The message to capture
 * @param level - Severity level ('fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug')
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (__DEV__) {
    console.log(`[Sentry] ${level.toUpperCase()}: ${message}`, context);
    return;
  }

  if (!SentryModule || !sentryInitialized) return;

  SentryModule.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set the current user for error tracking
 * Call after successful authentication
 * @param userId - User's ID
 * @param email - User's email (optional)
 */
export function setUser(userId: string, email?: string) {
  if (!SentryModule || !sentryInitialized) return;

  SentryModule.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user information
 * Call on logout
 */
export function clearUser() {
  if (!SentryModule || !sentryInitialized) return;

  SentryModule.setUser(null);
}

/**
 * Add a breadcrumb for debugging
 * @param message - Description of the action
 * @param category - Category (e.g., 'navigation', 'user', 'api')
 * @param data - Additional data
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  if (!SentryModule || !sentryInitialized) return;

  SentryModule.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Set a tag for filtering errors
 * @param key - Tag key
 * @param value - Tag value
 */
export function setTag(key: string, value: string) {
  if (!SentryModule || !sentryInitialized) return;

  SentryModule.setTag(key, value);
}

/**
 * Set the active team context
 * @param teamId - Current team ID
 * @param teamName - Current team name
 */
export function setTeamContext(teamId: string, teamName: string) {
  if (!SentryModule || !sentryInitialized) return;

  SentryModule.setTag('team_id', teamId);
  SentryModule.setTag('team_name', teamName);
}

/**
 * Clear team context (on team switch or logout)
 */
export function clearTeamContext() {
  if (!SentryModule || !sentryInitialized) return;

  SentryModule.setTag('team_id', '');
  SentryModule.setTag('team_name', '');
}

// Export Sentry module for advanced usage (may be null if not available)
export { SentryModule as Sentry };
