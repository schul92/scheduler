/**
 * Services and Assignments API
 *
 * API functions for service and assignment management
 */

import { supabase, getCurrentUserId } from '../supabase';
import {
  Service,
  ServiceWithAssignments,
  ServiceAssignment,
  AssignmentWithContext,
  ServiceInsert,
  ServiceUpdate,
  ServiceStatus,
  AssignmentStatus,
  Team,
  TeamMember,
  User,
  Role,
  MembershipRole,
} from '../../types/database.types';
import { AuthError, PermissionError, NotFoundError } from './teams';

// ============================================================================
// Types
// ============================================================================

/**
 * Service with assignment statistics
 */
export interface ServiceWithStats extends Service {
  /** Total number of assignments */
  assignment_count: number;
  /** Number of confirmed assignments */
  confirmed_count: number;
  /** Number of pending assignments */
  pending_count: number;
  /** Number of declined assignments */
  declined_count: number;
  /** Team info */
  team?: Pick<Team, 'id' | 'name' | 'color'>;
}

/**
 * Filters for fetching services
 */
export interface ServiceFilters {
  /** Start date (inclusive) */
  startDate?: string;
  /** End date (inclusive) */
  endDate?: string;
  /** Service status filter */
  status?: ServiceStatus | ServiceStatus[];
  /** Include past services (default: false) */
  includePast?: boolean;
}

/**
 * Data for creating a service
 */
export interface CreateServiceData {
  team_id: string;
  name: string;
  description?: string;
  service_date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  notes?: string;
  rehearsal_date?: string;
  rehearsal_time?: string;
  /** Service status - defaults to 'draft' if not specified */
  status?: ServiceStatus;
}

/**
 * Data for updating a service
 */
export interface UpdateServiceData {
  name?: string;
  description?: string | null;
  service_date?: string;
  start_time?: string;
  end_time?: string | null;
  location?: string | null;
  notes?: string | null;
  rehearsal_date?: string | null;
  rehearsal_time?: string | null;
  status?: ServiceStatus;
}

/**
 * Assignment with full details
 */
export interface AssignmentWithDetails extends ServiceAssignment {
  team_member: TeamMember & {
    user: User;
  };
  role: Role;
  assigned_by_user?: User | null;
}

/**
 * Response data for assignment
 */
export interface AssignmentResponseData {
  status: 'confirmed' | 'declined';
  decline_reason?: string;
}

/**
 * Upcoming assignment for dashboard
 */
export interface UpcomingAssignment {
  id: string;
  status: AssignmentStatus;
  service: {
    id: string;
    name: string;
    service_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    status: ServiceStatus;
  };
  role: {
    id: string;
    name: string;
    name_ko: string | null;
    color: string | null;
  };
  team: {
    id: string;
    name: string;
    color: string | null;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure user is authenticated
 */
async function requireAuth(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new AuthError();
  }
  return userId;
}

/**
 * Get user's role in a team
 */
async function getUserRole(
  teamId: string,
  userId: string
): Promise<MembershipRole | null> {
  const { data } = await supabase
    .from('team_members')
    .select('membership_role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return data?.membership_role || null;
}

/**
 * Check if user is admin or owner
 */
async function requireAdmin(teamId: string, userId: string): Promise<void> {
  const role = await getUserRole(teamId, userId);
  if (role !== 'owner' && role !== 'admin') {
    throw new PermissionError('Must be owner or admin');
  }
}

/**
 * Get team ID from service
 */
async function getTeamIdFromService(serviceId: string): Promise<string> {
  const { data, error } = await supabase
    .from('services')
    .select('team_id')
    .eq('id', serviceId)
    .single();

  if (error || !data) {
    throw new NotFoundError('Service not found');
  }

  return data.team_id;
}

/**
 * Get team ID from assignment
 */
async function getTeamIdFromAssignment(
  assignmentId: string
): Promise<{ teamId: string; teamMemberId: string; serviceId: string }> {
  const { data, error } = await supabase
    .from('service_assignments')
    .select(
      `
      id,
      team_member_id,
      service_id,
      services!inner (team_id)
    `
    )
    .eq('id', assignmentId)
    .single();

  if (error || !data) {
    throw new NotFoundError('Assignment not found');
  }

  return {
    teamId: (data.services as any).team_id,
    teamMemberId: data.team_member_id,
    serviceId: data.service_id,
  };
}

// ============================================================================
// Service API Functions
// ============================================================================

/**
 * Get all services for a team with optional filters
 *
 * @param teamId - The team ID
 * @param filters - Optional filters for date range and status
 * @returns Array of services with assignment statistics
 *
 * @example
 * const services = await getTeamServices(teamId, {
 *   startDate: '2024-01-01',
 *   endDate: '2024-12-31',
 *   status: ['published', 'completed']
 * });
 */
export async function getTeamServices(
  teamId: string,
  filters?: ServiceFilters
): Promise<ServiceWithStats[]> {
  const userId = await requireAuth();

  // Verify user is a member
  const userRole = await getUserRole(teamId, userId);
  if (!userRole) {
    throw new PermissionError('Not a member of this team');
  }

  // Build query
  let query = supabase
    .from('services')
    .select(
      `
      *,
      team:teams (id, name, color),
      assignments:service_assignments (
        id,
        status
      )
    `
    )
    .eq('team_id', teamId);

  // Apply filters
  if (filters?.startDate) {
    query = query.gte('service_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('service_date', filters.endDate);
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  // Non-admins can only see published/completed services
  if (userRole === 'member') {
    query = query.in('status', ['published', 'completed']);
  }

  // Filter past services unless explicitly included
  if (!filters?.includePast) {
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('service_date', today);
  }

  // Order by date
  query = query.order('service_date', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch services: ${error.message}`);
  }

  // Transform data to include assignment counts
  return (data || []).map((service) => {
    const assignments = (service.assignments || []) as { id: string; status: AssignmentStatus }[];

    return {
      ...service,
      team: service.team as ServiceWithStats['team'],
      assignments: undefined, // Remove raw assignments
      assignment_count: assignments.length,
      confirmed_count: assignments.filter((a) => a.status === 'confirmed').length,
      pending_count: assignments.filter((a) => a.status === 'pending').length,
      declined_count: assignments.filter((a) => a.status === 'declined').length,
    } as ServiceWithStats;
  });
}

/**
 * Get a service by ID with all assignment details
 *
 * @param serviceId - The service ID
 * @returns Service with full assignment details
 *
 * @example
 * const service = await getServiceById(serviceId);
 * service.assignments.forEach(a => {
 *   console.log(`${a.team_member.user.full_name} - ${a.role.name}`);
 * });
 */
export async function getServiceById(
  serviceId: string
): Promise<ServiceWithAssignments> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);

  // Verify user is a member
  const userRole = await getUserRole(teamId, userId);
  if (!userRole) {
    throw new PermissionError('Not a member of this team');
  }

  // Fetch service
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select(
      `
      *,
      team:teams (
        id,
        name,
        color,
        timezone,
        settings
      ),
      created_by_user:users!services_created_by_fkey (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq('id', serviceId)
    .single();

  if (serviceError || !service) {
    throw new NotFoundError('Service not found');
  }

  // Non-admins can only see published/completed services
  if (userRole === 'member' && !['published', 'completed'].includes(service.status)) {
    throw new PermissionError('Service not available');
  }

  // Fetch assignments with member and role details
  const { data: assignments, error: assignmentsError } = await supabase
    .from('service_assignments')
    .select(
      `
      *,
      team_member:team_members (
        id,
        user_id,
        membership_role,
        nickname,
        user:users (
          id,
          email,
          full_name,
          avatar_url,
          phone
        )
      ),
      role:roles (
        id,
        name,
        name_ko,
        color,
        icon,
        display_order
      )
    `
    )
    .eq('service_id', serviceId)
    .order('created_at', { ascending: true });

  if (assignmentsError) {
    throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
  }

  // Transform assignments
  const transformedAssignments = (assignments || []).map((a) => ({
    ...a,
    team_member: {
      ...a.team_member,
      user: (a.team_member as any).user,
    },
    role: a.role,
  })) as ServiceWithAssignments['assignments'];

  return {
    ...service,
    team: service.team as ServiceWithAssignments['team'],
    created_by_user: service.created_by_user as ServiceWithAssignments['created_by_user'],
    assignments: transformedAssignments,
  };
}

/**
 * Create a new service
 *
 * Requires admin or owner role.
 *
 * @param data - Service creation data
 * @returns The created service
 *
 * @example
 * const service = await createService({
 *   team_id: teamId,
 *   name: 'Sunday Worship',
 *   service_date: '2024-03-10',
 *   start_time: '10:00'
 * });
 */
export async function createService(data: CreateServiceData): Promise<Service> {
  const userId = await requireAuth();
  await requireAdmin(data.team_id, userId);

  const serviceData: ServiceInsert = {
    team_id: data.team_id,
    name: data.name,
    description: data.description || null,
    service_date: data.service_date,
    start_time: data.start_time,
    end_time: data.end_time || null,
    location: data.location || null,
    notes: data.notes || null,
    rehearsal_date: data.rehearsal_date || null,
    rehearsal_time: data.rehearsal_time || null,
    created_by: userId,
    status: data.status || 'draft',
  };

  const { data: service, error } = await supabase
    .from('services')
    .insert(serviceData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create service: ${error.message}`);
  }

  return service;
}

/**
 * Update a service
 *
 * Requires admin or owner role.
 *
 * @param serviceId - The service ID
 * @param data - Update data
 * @returns The updated service
 */
export async function updateService(
  serviceId: string,
  data: UpdateServiceData
): Promise<Service> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  const updateData: ServiceUpdate = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.service_date !== undefined) updateData.service_date = data.service_date;
  if (data.start_time !== undefined) updateData.start_time = data.start_time;
  if (data.end_time !== undefined) updateData.end_time = data.end_time;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.rehearsal_date !== undefined) updateData.rehearsal_date = data.rehearsal_date;
  if (data.rehearsal_time !== undefined) updateData.rehearsal_time = data.rehearsal_time;
  if (data.status !== undefined) updateData.status = data.status;

  const { data: service, error } = await supabase
    .from('services')
    .update(updateData)
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update service: ${error.message}`);
  }

  return service;
}

/**
 * Delete a service
 *
 * Requires admin or owner role. Cascades to assignments.
 *
 * @param serviceId - The service ID to delete
 */
export async function deleteService(serviceId: string): Promise<void> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  const { error } = await supabase.from('services').delete().eq('id', serviceId);

  if (error) {
    throw new Error(`Failed to delete service: ${error.message}`);
  }
}

/**
 * Publish a service
 *
 * Changes status to 'published' and sets published_at timestamp.
 * Requires admin or owner role.
 *
 * @param serviceId - The service ID to publish
 * @returns The updated service
 */
export async function publishService(serviceId: string): Promise<Service> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  const { data: service, error } = await supabase
    .from('services')
    .update({
      status: 'published' as ServiceStatus,
      published_at: new Date().toISOString(),
    })
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to publish service: ${error.message}`);
  }

  // Trigger push notifications to assigned members via Edge Function
  try {
    const { error: notifyError } = await supabase.functions.invoke('send-notification', {
      body: { serviceId, type: 'assignment' },
    });

    if (notifyError) {
      // Log but don't fail - notifications are non-critical
      console.error('[publishService] Failed to send notifications:', notifyError);
    } else {
      console.log('[publishService] Notifications sent for service:', serviceId);
    }
  } catch (notifyErr) {
    // Log but don't fail - notifications are non-critical
    console.error('[publishService] Error invoking notification function:', notifyErr);
  }

  return service;
}

/**
 * Mark a service as completed
 *
 * @param serviceId - The service ID
 * @returns The updated service
 */
export async function completeService(serviceId: string): Promise<Service> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  const { data: service, error } = await supabase
    .from('services')
    .update({ status: 'completed' as ServiceStatus })
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete service: ${error.message}`);
  }

  return service;
}

/**
 * Cancel a service
 *
 * @param serviceId - The service ID
 * @returns The updated service
 */
export async function cancelService(serviceId: string): Promise<Service> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  const { data: service, error } = await supabase
    .from('services')
    .update({ status: 'cancelled' as ServiceStatus })
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to cancel service: ${error.message}`);
  }

  // TODO: Notify assigned members

  return service;
}

// ============================================================================
// Assignment API Functions
// ============================================================================

/**
 * Create an assignment for a service
 *
 * Requires admin or owner role.
 *
 * @param serviceId - The service ID
 * @param teamMemberId - The team member ID to assign
 * @param roleId - The role ID to assign to
 * @returns The created assignment
 *
 * @example
 * const assignment = await createAssignment(serviceId, memberId, drumsRoleId);
 */
export async function createAssignment(
  serviceId: string,
  teamMemberId: string,
  roleId: string
): Promise<ServiceAssignment> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  // Check if assignment already exists
  const { data: existing } = await supabase
    .from('service_assignments')
    .select('id')
    .eq('service_id', serviceId)
    .eq('team_member_id', teamMemberId)
    .eq('role_id', roleId)
    .single();

  if (existing) {
    throw new Error('Assignment already exists');
  }

  const { data: assignment, error } = await supabase
    .from('service_assignments')
    .insert({
      service_id: serviceId,
      team_member_id: teamMemberId,
      role_id: roleId,
      status: 'pending' as AssignmentStatus,
      assigned_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create assignment: ${error.message}`);
  }

  return assignment;
}

/**
 * Create multiple assignments at once
 *
 * @param serviceId - The service ID
 * @param assignments - Array of { teamMemberId, roleId }
 * @returns Array of created assignments
 */
export async function createBulkAssignments(
  serviceId: string,
  assignments: { teamMemberId: string; roleId: string }[]
): Promise<ServiceAssignment[]> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  const assignmentData = assignments.map((a) => ({
    service_id: serviceId,
    team_member_id: a.teamMemberId,
    role_id: a.roleId,
    status: 'pending' as AssignmentStatus,
    assigned_by: userId,
  }));

  const { data, error } = await supabase
    .from('service_assignments')
    .insert(assignmentData)
    .select();

  if (error) {
    throw new Error(`Failed to create assignments: ${error.message}`);
  }

  return data || [];
}

/**
 * Remove an assignment
 *
 * Requires admin or owner role.
 *
 * @param assignmentId - The assignment ID to remove
 */
export async function removeAssignment(assignmentId: string): Promise<void> {
  const userId = await requireAuth();
  const { teamId } = await getTeamIdFromAssignment(assignmentId);
  await requireAdmin(teamId, userId);

  const { error } = await supabase
    .from('service_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) {
    throw new Error(`Failed to remove assignment: ${error.message}`);
  }
}

/**
 * Respond to an assignment (confirm or decline)
 *
 * Only the assigned member can respond.
 *
 * @param assignmentId - The assignment ID
 * @param response - Response data
 * @returns The updated assignment
 *
 * @example
 * // Confirm
 * await respondToAssignment(assignmentId, { status: 'confirmed' });
 *
 * // Decline with reason
 * await respondToAssignment(assignmentId, {
 *   status: 'declined',
 *   decline_reason: 'Out of town'
 * });
 */
export async function respondToAssignment(
  assignmentId: string,
  response: AssignmentResponseData
): Promise<ServiceAssignment> {
  const userId = await requireAuth();
  const { teamMemberId } = await getTeamIdFromAssignment(assignmentId);

  // Verify user is the assigned member
  const { data: member } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('id', teamMemberId)
    .single();

  if (!member || member.user_id !== userId) {
    throw new PermissionError('Can only respond to your own assignments');
  }

  const updateData: Partial<ServiceAssignment> = {
    status: response.status,
    responded_at: new Date().toISOString(),
  };

  if (response.status === 'declined' && response.decline_reason) {
    updateData.decline_reason = response.decline_reason;
  }

  const { data: assignment, error } = await supabase
    .from('service_assignments')
    .update(updateData)
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to respond to assignment: ${error.message}`);
  }

  return assignment;
}

/**
 * Get an assignment by ID with full details
 *
 * @param assignmentId - The assignment ID
 * @returns Assignment with member and role details
 */
export async function getAssignmentById(
  assignmentId: string
): Promise<AssignmentWithDetails> {
  await requireAuth();

  const { data, error } = await supabase
    .from('service_assignments')
    .select(
      `
      *,
      team_member:team_members (
        id,
        user_id,
        membership_role,
        nickname,
        user:users (
          id,
          email,
          full_name,
          avatar_url,
          phone
        )
      ),
      role:roles (
        id,
        name,
        name_ko,
        color,
        icon
      ),
      assigned_by_user:users!service_assignments_assigned_by_fkey (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq('id', assignmentId)
    .single();

  if (error || !data) {
    throw new NotFoundError('Assignment not found');
  }

  return {
    ...data,
    team_member: {
      ...(data.team_member as any),
      user: (data.team_member as any).user,
    },
    role: data.role as Role,
    assigned_by_user: data.assigned_by_user as User | null,
  };
}

/**
 * Get upcoming assignments for the current user across all teams
 *
 * Used for the dashboard view.
 *
 * @param limit - Maximum number of assignments to return (default: 5)
 * @returns Array of upcoming assignments with service and team info
 *
 * @example
 * const upcoming = await getUpcomingAssignments(10);
 * upcoming.forEach(a => {
 *   console.log(`${a.service.name} - ${a.role.name} on ${a.service.service_date}`);
 * });
 */
export async function getUpcomingAssignments(
  limit: number = 5
): Promise<UpcomingAssignment[]> {
  const userId = await requireAuth();

  const today = new Date().toISOString().split('T')[0];

  // Get user's team member IDs
  const { data: memberships } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const teamMemberIds = memberships.map((m) => m.id);

  // Get upcoming assignments
  const { data, error } = await supabase
    .from('service_assignments')
    .select(
      `
      id,
      status,
      service:services!inner (
        id,
        name,
        service_date,
        start_time,
        end_time,
        location,
        status,
        team:teams (
          id,
          name,
          color
        )
      ),
      role:roles (
        id,
        name,
        name_ko,
        color
      )
    `
    )
    .in('team_member_id', teamMemberIds)
    .gte('service.service_date', today)
    .in('service.status', ['published', 'completed'])
    .order('service(service_date)', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch upcoming assignments: ${error.message}`);
  }

  // Transform data
  return (data || []).map((a) => ({
    id: a.id,
    status: a.status,
    service: {
      id: (a.service as any).id,
      name: (a.service as any).name,
      service_date: (a.service as any).service_date,
      start_time: (a.service as any).start_time,
      end_time: (a.service as any).end_time,
      location: (a.service as any).location,
      status: (a.service as any).status,
    },
    role: {
      id: (a.role as any).id,
      name: (a.role as any).name,
      name_ko: (a.role as any).name_ko,
      color: (a.role as any).color,
    },
    team: {
      id: (a.service as any).team.id,
      name: (a.service as any).team.name,
      color: (a.service as any).team.color,
    },
  }));
}

/**
 * Get all assignments for the current user in a specific team
 *
 * @param teamId - The team ID
 * @param filters - Optional filters
 * @returns Array of assignments
 */
export async function getMyAssignments(
  teamId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: AssignmentStatus | AssignmentStatus[];
  }
): Promise<UpcomingAssignment[]> {
  const userId = await requireAuth();

  // Get user's team member ID for this team
  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!membership) {
    throw new PermissionError('Not a member of this team');
  }

  let query = supabase
    .from('service_assignments')
    .select(
      `
      id,
      status,
      service:services!inner (
        id,
        name,
        service_date,
        start_time,
        end_time,
        location,
        status,
        team:teams (
          id,
          name,
          color
        )
      ),
      role:roles (
        id,
        name,
        name_ko,
        color
      )
    `
    )
    .eq('team_member_id', membership.id)
    .eq('service.team_id', teamId);

  if (filters?.startDate) {
    query = query.gte('service.service_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('service.service_date', filters.endDate);
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  const { data, error } = await query.order('service(service_date)', {
    ascending: true,
  });

  if (error) {
    throw new Error(`Failed to fetch assignments: ${error.message}`);
  }

  // Transform data
  return (data || []).map((a) => ({
    id: a.id,
    status: a.status,
    service: {
      id: (a.service as any).id,
      name: (a.service as any).name,
      service_date: (a.service as any).service_date,
      start_time: (a.service as any).start_time,
      end_time: (a.service as any).end_time,
      location: (a.service as any).location,
      status: (a.service as any).status,
    },
    role: {
      id: (a.role as any).id,
      name: (a.role as any).name,
      name_ko: (a.role as any).name_ko,
      color: (a.role as any).color,
    },
    team: {
      id: (a.service as any).team.id,
      name: (a.service as any).team.name,
      color: (a.service as any).team.color,
    },
  }));
}

/**
 * Get assignment statistics for a team
 *
 * @param teamId - The team ID
 * @returns Statistics object
 */
export async function getTeamAssignmentStats(teamId: string): Promise<{
  total: number;
  pending: number;
  confirmed: number;
  declined: number;
  upcomingServices: number;
}> {
  const userId = await requireAuth();
  await getUserRole(teamId, userId); // Verify membership

  const today = new Date().toISOString().split('T')[0];

  // Get upcoming services count
  const { count: upcomingServices } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .gte('service_date', today)
    .in('status', ['draft', 'published']);

  // Get assignment stats for upcoming services
  const { data: services } = await supabase
    .from('services')
    .select('id')
    .eq('team_id', teamId)
    .gte('service_date', today);

  if (!services || services.length === 0) {
    return {
      total: 0,
      pending: 0,
      confirmed: 0,
      declined: 0,
      upcomingServices: upcomingServices || 0,
    };
  }

  const serviceIds = services.map((s) => s.id);

  const { data: assignments } = await supabase
    .from('service_assignments')
    .select('status')
    .in('service_id', serviceIds);

  const stats = {
    total: assignments?.length || 0,
    pending: assignments?.filter((a) => a.status === 'pending').length || 0,
    confirmed: assignments?.filter((a) => a.status === 'confirmed').length || 0,
    declined: assignments?.filter((a) => a.status === 'declined').length || 0,
    upcomingServices: upcomingServices || 0,
  };

  return stats;
}

// ============================================================================
// Role and Assignment Sync Functions
// ============================================================================

/**
 * Get all roles for a team
 *
 * @param teamId - The team ID
 * @returns Array of roles
 */
export async function getTeamRoles(teamId: string): Promise<Role[]> {
  const userId = await requireAuth();
  const userRole = await getUserRole(teamId, userId);
  if (!userRole) {
    throw new PermissionError('Not a member of this team');
  }

  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }

  return data || [];
}

/**
 * Get or create a role by name
 *
 * @param teamId - The team ID
 * @param name - Role name (English)
 * @param nameKo - Role name (Korean, optional)
 * @param icon - Icon/emoji for the role
 * @returns The role (existing or newly created)
 */
export async function getOrCreateRole(
  teamId: string,
  name: string,
  nameKo?: string,
  icon?: string
): Promise<Role> {
  const userId = await requireAuth();
  await requireAdmin(teamId, userId);

  // Check if role exists (case-insensitive)
  const { data: existing } = await supabase
    .from('roles')
    .select('*')
    .eq('team_id', teamId)
    .ilike('name', name)
    .single();

  if (existing) {
    return existing as Role;
  }

  // Create new role
  const { data: newRole, error } = await supabase
    .from('roles')
    .insert({
      team_id: teamId,
      name: name,
      name_ko: nameKo || name,
      icon: icon || '🎵',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create role: ${error.message}`);
  }

  return newRole as Role;
}

/**
 * Sync assignments from local store to Supabase
 *
 * This replaces all assignments for a service with the new ones.
 *
 * @param serviceId - The service ID
 * @param assignments - Array of { teamMemberId, roleId, roleName }
 * @returns Array of created assignments
 */
export async function syncAssignmentsToSupabase(
  serviceId: string,
  assignments: { teamMemberId: string; roleId: string }[]
): Promise<ServiceAssignment[]> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromService(serviceId);
  await requireAdmin(teamId, userId);

  // First, delete all existing assignments for this service
  const { error: deleteError } = await supabase
    .from('service_assignments')
    .delete()
    .eq('service_id', serviceId);

  if (deleteError) {
    throw new Error(`Failed to clear existing assignments: ${deleteError.message}`);
  }

  // If no new assignments, just return empty
  if (assignments.length === 0) {
    return [];
  }

  // Create new assignments
  const assignmentData = assignments.map((a) => ({
    service_id: serviceId,
    team_member_id: a.teamMemberId,
    role_id: a.roleId,
    status: 'pending' as AssignmentStatus,
    assigned_by: userId,
  }));

  const { data, error } = await supabase
    .from('service_assignments')
    .insert(assignmentData)
    .select();

  if (error) {
    throw new Error(`Failed to create assignments: ${error.message}`);
  }

  return data || [];
}

/**
 * Get service by date and name
 *
 * @param teamId - The team ID
 * @param serviceDate - Service date (YYYY-MM-DD)
 * @param serviceName - Service name (optional, for filtering when multiple services per date)
 * @returns Service or null
 */
export async function getServiceByDateAndName(
  teamId: string,
  serviceDate: string,
  serviceName?: string
): Promise<Service | null> {
  const userId = await requireAuth();
  const userRole = await getUserRole(teamId, userId);
  if (!userRole) {
    throw new PermissionError('Not a member of this team');
  }

  let query = supabase
    .from('services')
    .select('*')
    .eq('team_id', teamId)
    .eq('service_date', serviceDate);

  if (serviceName) {
    query = query.ilike('name', `%${serviceName}%`);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch service: ${error.message}`);
  }

  return data;
}
