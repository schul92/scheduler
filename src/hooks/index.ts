/**
 * Hooks Exports
 *
 * Re-export all custom hooks from a single entry point
 */

// Permissions
export {
  usePermissions,
  useCanPerform,
  useIsTeamAdmin,
  useIsTeamOwner,
  useMyRole,
} from './usePermissions';
export type { UsePermissionsResult } from './usePermissions';

// Teams
export { useTeams } from './useTeams';
export type { UseTeamsResult } from './useTeams';

export { useTeam } from './useTeam';
export type { UseTeamResult } from './useTeam';

export { useTeamMember, useActiveTeamMember } from './useTeamMember';
export type { UseTeamMemberResult } from './useTeamMember';

// Services
export { useServices, useActiveTeamServices } from './useServices';
export type { UseServicesResult } from './useServices';

export { useService } from './useService';
export type { UseServiceResult } from './useService';

// Availability
export { useAvailability, useTeamAvailability } from './useAvailability';
export type {
  DateRange,
  UseAvailabilityResult,
  UseTeamAvailabilityResult,
} from './useAvailability';

// Calendar
export {
  usePersonalCalendar,
  usePersonalCalendarRange,
  useUpcomingServices,
} from './usePersonalCalendar';
export type {
  UsePersonalCalendarResult,
  UseUpcomingServicesResult,
} from './usePersonalCalendar';
