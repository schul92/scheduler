/**
 * Analytics (PostHog)
 *
 * User activity tracking and product analytics.
 * Uses PostHogProvider from _layout.tsx - use usePostHog() hook in components.
 */

import { usePostHog } from 'posthog-react-native';

// Re-export hook for convenience
export { usePostHog };

// ============================================================================
// Event Names (use these constants for consistency)
// ============================================================================

export const ANALYTICS_EVENTS = {
  // Auth events
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'signup',

  // Team events
  TEAM_CREATED: 'team_created',
  TEAM_JOINED: 'team_joined',
  TEAM_LEFT: 'team_left',

  // Availability events
  AVAILABILITY_SUBMITTED: 'availability_submitted',
  AVAILABILITY_REQUEST_SENT: 'availability_request_sent',

  // Scheduling events
  SCHEDULE_CONFIRMED: 'schedule_confirmed',
  SERVICE_ASSIGNED: 'service_assigned',
  SERVICE_PUBLISHED: 'service_published',

  // Feature usage
  CALENDAR_EXPORTED: 'calendar_exported',
  SHARE_USED: 'share_used',
  NOTIFICATION_SENT: 'notification_sent',
} as const;

// ============================================================================
// Helper Hook for Common Analytics Actions
// ============================================================================

/**
 * Custom hook that provides typed analytics functions
 *
 * @example
 * const { trackTeamCreated, identify } = useAnalytics();
 * trackTeamCreated('team-123', 'My Team');
 */
export function useAnalytics() {
  const posthog = usePostHog();

  return {
    // Raw tracking
    track: (event: string, properties?: Record<string, any>) => {
      posthog.capture(event, properties);
    },

    // User identification
    identify: (userId: string, properties?: Record<string, any>) => {
      posthog.identify(userId, properties);
    },

    // Reset on logout
    reset: () => {
      posthog.reset();
    },

    // Screen tracking
    screen: (name: string, properties?: Record<string, any>) => {
      posthog.screen(name, properties);
    },

    // ========================================================================
    // Pre-defined event helpers
    // ========================================================================

    trackLogin: (method: 'google' | 'apple') => {
      posthog.capture(ANALYTICS_EVENTS.LOGIN, { method });
    },

    trackLogout: () => {
      posthog.capture(ANALYTICS_EVENTS.LOGOUT);
    },

    trackTeamCreated: (teamId: string, teamName: string) => {
      posthog.capture(ANALYTICS_EVENTS.TEAM_CREATED, {
        team_id: teamId,
        team_name: teamName,
      });
    },

    trackTeamJoined: (teamId: string, teamName: string) => {
      posthog.capture(ANALYTICS_EVENTS.TEAM_JOINED, {
        team_id: teamId,
        team_name: teamName,
      });
    },

    trackAvailabilitySubmitted: (
      teamId: string,
      dateCount: number,
      availableCount: number
    ) => {
      posthog.capture(ANALYTICS_EVENTS.AVAILABILITY_SUBMITTED, {
        team_id: teamId,
        date_count: dateCount,
        available_count: availableCount,
      });
    },

    trackScheduleConfirmed: (teamId: string, dateCount: number) => {
      posthog.capture(ANALYTICS_EVENTS.SCHEDULE_CONFIRMED, {
        team_id: teamId,
        date_count: dateCount,
      });
    },

    trackServiceAssigned: (
      teamId: string,
      serviceDate: string,
      memberCount: number
    ) => {
      posthog.capture(ANALYTICS_EVENTS.SERVICE_ASSIGNED, {
        team_id: teamId,
        service_date: serviceDate,
        member_count: memberCount,
      });
    },

    trackShare: (type: 'calendar' | 'invite' | 'schedule') => {
      posthog.capture(ANALYTICS_EVENTS.SHARE_USED, { type });
    },
  };
}