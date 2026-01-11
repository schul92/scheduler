/**
 * Sentry Error Tracking
 *
 * Centralized error tracking and reporting for production monitoring.
 */

import * as Sentry from '@sentry/react-native';

/**
 * Initialize Sentry error tracking
 * Call this at app startup in _layout.tsx
 */
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.warn('[Sentry] No DSN configured - error tracking disabled');
    return;
  }

  Sentry.init({
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

  Sentry.captureException(err, {
    extra: context,
  });
}

/**
 * Capture a message (non-error event)
 * @param message - The message to capture
 * @param level - Severity level
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) {
  if (__DEV__) {
    console.log(`[Sentry] ${level.toUpperCase()}: ${message}`, context);
    return;
  }

  Sentry.captureMessage(message, {
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
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user information
 * Call on logout
 */
export function clearUser() {
  Sentry.setUser(null);
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
  Sentry.addBreadcrumb({
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
  Sentry.setTag(key, value);
}

/**
 * Set the active team context
 * @param teamId - Current team ID
 * @param teamName - Current team name
 */
export function setTeamContext(teamId: string, teamName: string) {
  Sentry.setTag('team_id', teamId);
  Sentry.setTag('team_name', teamName);
}

/**
 * Clear team context (on team switch or logout)
 */
export function clearTeamContext() {
  Sentry.setTag('team_id', '');
  Sentry.setTag('team_name', '');
}

// Export Sentry for advanced usage
export { Sentry };
