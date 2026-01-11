/**
 * API Layer Exports
 *
 * Re-export all API functions from a single entry point
 */

// Teams API
export {
  // Functions
  getUserTeams,
  getTeamById,
  getTeamByInviteCode,
  createTeam,
  updateTeam,
  deleteTeam,
  transferOwnership,
  leaveTeam,
  joinTeamByCode,
  regenerateInviteCode,
  getTeamMemberCount,
  isTeamMember,
  // Error classes
  AuthError,
  PermissionError,
  NotFoundError,
} from './teams';

// Members API
export {
  getTeamMembers,
  getTeamMember,
  inviteMember,
  getInvitation,
  acceptInvitation,
  cancelInvitation,
  getTeamInvitations,
  updateMemberRole,
  removeMember,
  updateMemberRoles,
  addMemberRole,
  removeMemberRole,
  updateMemberNickname,
} from './members';

// Types
export type {
  TeamWithMembers,
  CreateTeamData,
  UpdateTeamData,
} from './teams';

export type {
  MemberWithRoles,
  InviteData,
  InvitationWithTeam,
  UpdateMemberRolesData,
} from './members';

// Services API
export {
  // Service functions
  getTeamServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  publishService,
  completeService,
  cancelService,
  // Assignment functions
  createAssignment,
  createBulkAssignments,
  removeAssignment,
  respondToAssignment,
  getAssignmentById,
  // Dashboard/query functions
  getUpcomingAssignments,
  getMyAssignments,
  getTeamAssignmentStats,
  // Role and sync functions
  getTeamRoles,
  getOrCreateRole,
  syncAssignmentsToSupabase,
  getServiceByDateAndName,
} from './services';

export type {
  ServiceWithStats,
  ServiceFilters,
  CreateServiceData,
  UpdateServiceData,
  AssignmentWithDetails,
  AssignmentResponseData,
  UpcomingAssignment,
} from './services';

// Availability API
export {
  getAvailability,
  setAvailability,
  bulkSetAvailability,
  deleteAvailability,
  getTeamAvailability,
  getTeamAvailabilityRange,
} from './availability';

export type {
  AvailabilityRecord,
  SetAvailabilityData,
  MemberAvailability,
  TeamAvailabilitySummary,
} from './availability';

// Calendar API
export {
  getPersonalCalendar,
  getUpcomingServices,
  generateICS,
  recordCalendarSync,
  getMySyncedEvents,
  deleteCalendarSync,
  recordSyncError,
} from './calendar';

export type {
  UpcomingService,
  ICSEvent,
  CalendarSyncWithDetails,
} from './calendar';
