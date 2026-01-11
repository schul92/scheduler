/**
 * Teams API
 *
 * API functions for team management
 */

import { supabase, getCurrentUserId } from '../supabase';
import {
  Team,
  TeamWithMembership,
  TeamMemberWithUser,
  TeamInsert,
  TeamUpdate,
  User,
  Role,
  MemberRole,
  MembershipRole,
  MemberStatus,
} from '../../types/database.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Error thrown when user is not authenticated
 */
export class AuthError extends Error {
  constructor(message = 'Not authenticated') {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Error thrown when user doesn't have permission
 */
export class PermissionError extends Error {
  constructor(message = 'Permission denied') {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Error thrown when resource is not found
 */
export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Team with full member details
 */
export interface TeamWithMembers extends Team {
  members: TeamMemberWithUser[];
  roles: Role[];
}

/**
 * Data for creating a new team
 */
export interface CreateTeamData {
  name: string;
  description?: string;
  color?: string;
  timezone?: string;
}

/**
 * Data for updating a team
 */
export interface UpdateTeamData {
  name?: string;
  description?: string | null;
  color?: string;
  timezone?: string;
  settings?: TeamUpdate['settings'];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure user is authenticated, throw if not
 */
async function requireAuth(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new AuthError();
  }
  return userId;
}

/**
 * Get user's membership role in a team
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
 * Check if user is admin or owner of a team
 */
async function requireAdmin(teamId: string, userId: string): Promise<void> {
  const role = await getUserRole(teamId, userId);
  if (role !== 'owner' && role !== 'admin') {
    throw new PermissionError('Must be owner or admin');
  }
}

/**
 * Check if user is owner of a team
 */
async function requireOwner(teamId: string, userId: string): Promise<void> {
  const role = await getUserRole(teamId, userId);
  if (role !== 'owner') {
    throw new PermissionError('Must be owner');
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all teams the current user belongs to with membership info
 *
 * @returns Array of teams with user's membership role
 *
 * @example
 * const teams = await getUserTeams();
 * teams.forEach(team => {
 *   console.log(`${team.name} - ${team.membership_role}`);
 * });
 */
export async function getUserTeams(): Promise<TeamWithMembership[]> {
  const userId = await requireAuth();

  const { data, error } = await supabase
    .from('team_members')
    .select(
      `
      id,
      membership_role,
      status,
      nickname,
      joined_at,
      teams (
        id,
        name,
        description,
        owner_id,
        color,
        timezone,
        settings,
        invite_code,
        created_at,
        updated_at
      )
    `
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  // Transform to TeamWithMembership format
  return (data || [])
    .filter((item) => item.teams)
    .map((item) => {
      const team = item.teams as unknown as Team;
      return {
        ...team,
        membership_role: item.membership_role,
        membership_status: item.status,
        team_member_id: item.id,
        joined_at: item.joined_at,
        nickname: item.nickname,
      };
    });
}

/**
 * Get a team by ID with all members and their roles
 *
 * @param teamId - The team ID to fetch
 * @returns Team with members and roles
 *
 * @example
 * const team = await getTeamById('team-uuid');
 * console.log(`Team: ${team.name}`);
 * team.members.forEach(m => console.log(m.user.full_name));
 */
export async function getTeamById(teamId: string): Promise<TeamWithMembers> {
  const userId = await requireAuth();

  // Check if user is a member of this team
  const role = await getUserRole(teamId, userId);
  if (!role) {
    throw new PermissionError('Not a member of this team');
  }

  // Fetch team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (teamError || !team) {
    throw new NotFoundError('Team not found');
  }

  // Fetch team members with user info and their roles
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select(
      `
      *,
      user:users (
        id,
        email,
        full_name,
        phone,
        avatar_url,
        preferred_language
      ),
      member_roles (
        id,
        role_id,
        proficiency_level,
        is_primary,
        notes,
        role:roles (
          id,
          name,
          name_ko,
          color,
          icon,
          display_order
        )
      )
    `
    )
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('membership_role', { ascending: true });

  if (membersError) {
    throw new Error(`Failed to fetch team members: ${membersError.message}`);
  }

  // Fetch team roles
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (rolesError) {
    throw new Error(`Failed to fetch team roles: ${rolesError.message}`);
  }

  // Transform members data
  const transformedMembers: TeamMemberWithUser[] = (members || []).map(
    (member) => ({
      ...member,
      user: member.user as unknown as User,
      member_roles: (member.member_roles || []).map((mr: any) => ({
        ...mr,
        role: mr.role as Role,
      })),
    })
  );

  return {
    ...team,
    members: transformedMembers,
    roles: roles || [],
  };
}

/**
 * Get a team by invite code
 *
 * @param inviteCode - The team's invite code
 * @returns Team basic info
 */
export async function getTeamByInviteCode(
  inviteCode: string
): Promise<Pick<Team, 'id' | 'name' | 'description' | 'color'> | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, description, color')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Create a new team
 *
 * The creating user automatically becomes the owner via database trigger.
 *
 * @param data - Team creation data
 * @returns The created team
 *
 * @example
 * const team = await createTeam({
 *   name: 'Grace Church Worship',
 *   description: 'Sunday morning worship team',
 *   color: '#3498DB'
 * });
 */
export async function createTeam(data: CreateTeamData): Promise<Team> {
  const userId = await requireAuth();

  const teamData: TeamInsert = {
    name: data.name,
    description: data.description || null,
    color: data.color || '#D4A574',
    timezone: data.timezone || 'America/Los_Angeles',
    owner_id: userId,
  };

  const { data: team, error } = await supabase
    .from('teams')
    .insert(teamData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create team: ${error.message}`);
  }

  return team;
}

/**
 * Update team settings
 *
 * Requires owner or admin role.
 *
 * @param teamId - The team ID to update
 * @param data - Update data
 * @returns The updated team
 *
 * @example
 * const team = await updateTeam(teamId, {
 *   name: 'New Team Name',
 *   settings: { reminder_hours_before: 48 }
 * });
 */
export async function updateTeam(
  teamId: string,
  data: UpdateTeamData
): Promise<Team> {
  const userId = await requireAuth();
  await requireAdmin(teamId, userId);

  const updateData: TeamUpdate = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.settings !== undefined) updateData.settings = data.settings;

  const { data: team, error } = await supabase
    .from('teams')
    .update(updateData)
    .eq('id', teamId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update team: ${error.message}`);
  }

  return team;
}

/**
 * Delete a team
 *
 * Requires owner role. All related data is cascaded.
 *
 * @param teamId - The team ID to delete
 *
 * @example
 * await deleteTeam(teamId);
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const userId = await requireAuth();
  await requireOwner(teamId, userId);

  const { error } = await supabase.from('teams').delete().eq('id', teamId);

  if (error) {
    throw new Error(`Failed to delete team: ${error.message}`);
  }
}

/**
 * Transfer team ownership to another member
 *
 * Requires owner role. The new owner must be an active member.
 *
 * @param teamId - The team ID
 * @param newOwnerId - The user ID of the new owner
 * @returns Success status
 *
 * @example
 * await transferOwnership(teamId, newOwnerId);
 */
export async function transferOwnership(
  teamId: string,
  newOwnerId: string
): Promise<boolean> {
  const userId = await requireAuth();
  await requireOwner(teamId, userId);

  // Call the database function
  const { data, error } = await supabase.rpc('transfer_team_ownership', {
    p_team_id: teamId,
    p_new_owner_id: newOwnerId,
  });

  if (error) {
    throw new Error(`Failed to transfer ownership: ${error.message}`);
  }

  return data === true;
}

/**
 * Leave a team
 *
 * Cannot leave if you are the owner - must transfer ownership first.
 *
 * @param teamId - The team ID to leave
 *
 * @example
 * await leaveTeam(teamId);
 */
export async function leaveTeam(teamId: string): Promise<void> {
  const userId = await requireAuth();

  // Check if user is owner
  const role = await getUserRole(teamId, userId);
  if (role === 'owner') {
    throw new PermissionError(
      'Owner cannot leave team. Transfer ownership first.'
    );
  }

  if (!role) {
    throw new NotFoundError('Not a member of this team');
  }

  // Set status to inactive (soft delete)
  const { error } = await supabase
    .from('team_members')
    .update({ status: 'inactive' as MemberStatus })
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to leave team: ${error.message}`);
  }
}

/**
 * Join a team by invite code
 *
 * @param inviteCode - The team's invite code
 * @returns The joined team
 *
 * @example
 * const team = await joinTeamByCode('ABC123XY');
 */
export async function joinTeamByCode(inviteCode: string): Promise<Team> {
  const userId = await requireAuth();

  // Find team by invite code
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (teamError || !team) {
    throw new NotFoundError('Invalid invite code');
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('team_id', team.id)
    .eq('user_id', userId)
    .single();

  if (existingMember) {
    if (existingMember.status === 'active') {
      throw new Error('Already a member of this team');
    }
    // Reactivate membership
    await supabase
      .from('team_members')
      .update({ status: 'active' as MemberStatus })
      .eq('id', existingMember.id);

    return team;
  }

  // Create new membership
  const { error: joinError } = await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: userId,
    membership_role: 'member' as MembershipRole,
    status: 'active' as MemberStatus,
  });

  if (joinError) {
    throw new Error(`Failed to join team: ${joinError.message}`);
  }

  return team;
}

/**
 * Regenerate team invite code
 *
 * Requires owner or admin role.
 *
 * @param teamId - The team ID
 * @returns The new invite code
 */
export async function regenerateInviteCode(teamId: string): Promise<string> {
  const userId = await requireAuth();
  await requireAdmin(teamId, userId);

  // Generate new code using database function
  const { data: newCode, error: genError } = await supabase.rpc(
    'generate_invite_code'
  );

  if (genError) {
    throw new Error(`Failed to generate invite code: ${genError.message}`);
  }

  // Update team with new code
  const { data: team, error: updateError } = await supabase
    .from('teams')
    .update({ invite_code: newCode })
    .eq('id', teamId)
    .select('invite_code')
    .single();

  if (updateError) {
    throw new Error(`Failed to update invite code: ${updateError.message}`);
  }

  return team.invite_code!;
}

/**
 * Get team member count
 *
 * @param teamId - The team ID
 * @returns Number of active members
 */
export async function getTeamMemberCount(teamId: string): Promise<number> {
  const { count, error } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to get member count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Check if a user is a member of a team
 *
 * @param teamId - The team ID
 * @param userId - The user ID (optional, uses current user if not provided)
 * @returns Whether the user is an active member
 */
export async function isTeamMember(
  teamId: string,
  userId?: string
): Promise<boolean> {
  const checkUserId = userId || (await getCurrentUserId());
  if (!checkUserId) return false;

  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', checkUserId)
    .eq('status', 'active')
    .single();

  return !!data;
}
