/**
 * Members API
 *
 * API functions for team member management
 */

import { supabase, getCurrentUserId } from '../supabase';
import {
  TeamMember,
  TeamMemberWithUser,
  TeamInvitation,
  User,
  Role,
  MemberRole,
  MembershipRole,
  MemberStatus,
  InvitationStatus,
  ProficiencyLevel,
} from '../../types/database.types';
import { AuthError, PermissionError, NotFoundError } from './teams';

// ============================================================================
// Types
// ============================================================================

/**
 * Team member with full user details and musical roles
 */
export interface MemberWithRoles extends TeamMember {
  user: User;
  member_roles: (MemberRole & {
    role: Role;
  })[];
}

/**
 * Data for creating an invitation
 */
export interface InviteData {
  email?: string;
  phone?: string;
  message?: string;
  role_suggestion?: MembershipRole;
}

/**
 * Invitation with team details
 */
export interface InvitationWithTeam extends TeamInvitation {
  team: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  invited_by_user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Data for updating musical roles
 */
export interface UpdateMemberRolesData {
  /** Role IDs the member can play */
  roleIds: string[];
  /** Which role is the primary one */
  primaryRoleId?: string;
  /** Proficiency levels for each role (optional) */
  proficiencyLevels?: Record<string, ProficiencyLevel>;
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
 * Check if user is admin or owner
 */
async function requireAdmin(teamId: string, userId: string): Promise<void> {
  const role = await getUserRole(teamId, userId);
  if (role !== 'owner' && role !== 'admin') {
    throw new PermissionError('Must be owner or admin');
  }
}

/**
 * Get team ID from team member ID
 */
async function getTeamIdFromMember(teamMemberId: string): Promise<string> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('id', teamMemberId)
    .single();

  if (error || !data) {
    throw new NotFoundError('Team member not found');
  }

  return data.team_id;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all members of a team with their user info and musical roles
 *
 * Results are ordered: owner first, then admins, then members by name
 *
 * @param teamId - The team ID
 * @returns Array of members with user details and roles
 *
 * @example
 * const members = await getTeamMembers(teamId);
 * members.forEach(m => {
 *   console.log(`${m.user.full_name} - ${m.membership_role}`);
 *   m.member_roles.forEach(mr => console.log(`  ${mr.role.name}`));
 * });
 */
export async function getTeamMembers(teamId: string): Promise<MemberWithRoles[]> {
  const userId = await requireAuth();

  // Verify user is a member of this team
  const userRole = await getUserRole(teamId, userId);
  if (!userRole) {
    throw new PermissionError('Not a member of this team');
  }

  const { data, error } = await supabase
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
        preferred_language,
        kakao_id,
        created_at,
        updated_at
      ),
      member_roles (
        id,
        role_id,
        proficiency_level,
        is_primary,
        notes,
        created_at,
        updated_at,
        role:roles (
          id,
          team_id,
          name,
          name_ko,
          description,
          color,
          icon,
          display_order,
          is_active
        )
      )
    `
    )
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to fetch team members: ${error.message}`);
  }

  // Transform and sort the data
  const members: MemberWithRoles[] = (data || []).map((member) => ({
    ...member,
    user: member.user as unknown as User,
    member_roles: (member.member_roles || []).map((mr: any) => ({
      ...mr,
      role: mr.role as Role,
    })),
  }));

  // Sort: owner first, then admin, then member, then by name
  const roleOrder: Record<MembershipRole, number> = {
    owner: 0,
    admin: 1,
    member: 2,
  };

  members.sort((a, b) => {
    const roleCompare = roleOrder[a.membership_role] - roleOrder[b.membership_role];
    if (roleCompare !== 0) return roleCompare;

    // Sort by name within same role
    const nameA = a.user?.full_name || '';
    const nameB = b.user?.full_name || '';
    return nameA.localeCompare(nameB);
  });

  return members;
}

/**
 * Get a single team member by ID
 *
 * @param teamMemberId - The team member ID
 * @returns Member with user details and roles
 */
export async function getTeamMember(teamMemberId: string): Promise<MemberWithRoles> {
  await requireAuth();

  const { data, error } = await supabase
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
        preferred_language,
        kakao_id,
        created_at,
        updated_at
      ),
      member_roles (
        id,
        role_id,
        proficiency_level,
        is_primary,
        notes,
        created_at,
        updated_at,
        role:roles (
          id,
          team_id,
          name,
          name_ko,
          description,
          color,
          icon,
          display_order,
          is_active
        )
      )
    `
    )
    .eq('id', teamMemberId)
    .single();

  if (error || !data) {
    throw new NotFoundError('Team member not found');
  }

  return {
    ...data,
    user: data.user as unknown as User,
    member_roles: (data.member_roles || []).map((mr: any) => ({
      ...mr,
      role: mr.role as Role,
    })),
  };
}

/**
 * Create an invitation to join a team
 *
 * Requires admin or owner role.
 *
 * @param teamId - The team ID
 * @param data - Invitation data (email or phone required)
 * @returns The created invitation with token
 *
 * @example
 * const invitation = await inviteMember(teamId, {
 *   email: 'newmember@example.com',
 *   message: 'Join our worship team!'
 * });
 * console.log(`Share this link: /join/${invitation.token}`);
 */
export async function inviteMember(
  teamId: string,
  data: InviteData
): Promise<TeamInvitation> {
  const userId = await requireAuth();
  await requireAdmin(teamId, userId);

  // Validate that email or phone is provided
  if (!data.email && !data.phone) {
    throw new Error('Email or phone is required');
  }

  // Check for existing pending invitation
  const existingQuery = supabase
    .from('team_invitations')
    .select('id')
    .eq('team_id', teamId)
    .eq('status', 'pending');

  if (data.email) {
    existingQuery.eq('email', data.email);
  } else if (data.phone) {
    existingQuery.eq('phone', data.phone);
  }

  const { data: existing } = await existingQuery.single();

  if (existing) {
    throw new Error('An invitation already exists for this contact');
  }

  // Check if already a member
  if (data.email) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .single();

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', existingUser.id)
        .eq('status', 'active')
        .single();

      if (existingMember) {
        throw new Error('This person is already a member of the team');
      }
    }
  }

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('team_invitations')
    .insert({
      team_id: teamId,
      email: data.email || null,
      phone: data.phone || null,
      invited_by: userId,
      message: data.message || null,
      role_suggestion: data.role_suggestion || 'member',
      status: 'pending' as InvitationStatus,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return invitation;
}

/**
 * Get invitation details by token
 *
 * Used to display invitation info before accepting.
 *
 * @param token - The invitation token
 * @returns Invitation with team and inviter details
 *
 * @example
 * const invitation = await getInvitation(token);
 * console.log(`You're invited to join ${invitation.team.name}`);
 */
export async function getInvitation(token: string): Promise<InvitationWithTeam> {
  const { data, error } = await supabase
    .from('team_invitations')
    .select(
      `
      *,
      team:teams (
        id,
        name,
        description,
        color
      ),
      invited_by_user:users!team_invitations_invited_by_fkey (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq('token', token)
    .single();

  if (error || !data) {
    throw new NotFoundError('Invitation not found');
  }

  // Check if invitation is still valid
  if (data.status !== 'pending') {
    throw new Error(`Invitation is ${data.status}`);
  }

  if (new Date(data.expires_at) < new Date()) {
    // Update status to expired
    await supabase
      .from('team_invitations')
      .update({ status: 'expired' as InvitationStatus })
      .eq('id', data.id);

    throw new Error('Invitation has expired');
  }

  return {
    ...data,
    team: data.team as InvitationWithTeam['team'],
    invited_by_user: data.invited_by_user as InvitationWithTeam['invited_by_user'],
  };
}

/**
 * Accept an invitation and join the team
 *
 * @param token - The invitation token
 * @returns The joined team info
 *
 * @example
 * const { team } = await acceptInvitation(token);
 * console.log(`Welcome to ${team.name}!`);
 */
export async function acceptInvitation(
  token: string
): Promise<{ team: InvitationWithTeam['team']; teamMemberId: string }> {
  const userId = await requireAuth();

  // Get invitation
  const invitation = await getInvitation(token);

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('team_id', invitation.team.id)
    .eq('user_id', userId)
    .single();

  let teamMemberId: string;

  if (existingMember) {
    if (existingMember.status === 'active') {
      throw new Error('Already a member of this team');
    }
    // Reactivate membership
    const { error: updateError } = await supabase
      .from('team_members')
      .update({ status: 'active' as MemberStatus })
      .eq('id', existingMember.id);

    if (updateError) {
      throw new Error(`Failed to reactivate membership: ${updateError.message}`);
    }
    teamMemberId = existingMember.id;
  } else {
    // Create new membership
    const { data: newMember, error: joinError } = await supabase
      .from('team_members')
      .insert({
        team_id: invitation.team.id,
        user_id: userId,
        membership_role: invitation.role_suggestion || 'member',
        status: 'active' as MemberStatus,
      })
      .select()
      .single();

    if (joinError) {
      throw new Error(`Failed to join team: ${joinError.message}`);
    }
    teamMemberId = newMember.id;
  }

  // Update invitation status
  await supabase
    .from('team_invitations')
    .update({
      status: 'accepted' as InvitationStatus,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id);

  return { team: invitation.team, teamMemberId };
}

/**
 * Cancel a pending invitation
 *
 * Requires admin or owner role.
 *
 * @param invitationId - The invitation ID to cancel
 *
 * @example
 * await cancelInvitation(invitationId);
 */
export async function cancelInvitation(invitationId: string): Promise<void> {
  const userId = await requireAuth();

  // Get invitation to check team
  const { data: invitation, error: fetchError } = await supabase
    .from('team_invitations')
    .select('team_id, status')
    .eq('id', invitationId)
    .single();

  if (fetchError || !invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Cannot cancel invitation with status: ${invitation.status}`);
  }

  await requireAdmin(invitation.team_id, userId);

  const { error } = await supabase
    .from('team_invitations')
    .update({ status: 'cancelled' as InvitationStatus })
    .eq('id', invitationId);

  if (error) {
    throw new Error(`Failed to cancel invitation: ${error.message}`);
  }
}

/**
 * Get all pending invitations for a team
 *
 * Requires admin or owner role.
 *
 * @param teamId - The team ID
 * @returns Array of pending invitations
 */
export async function getTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
  const userId = await requireAuth();
  await requireAdmin(teamId, userId);

  const { data, error } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch invitations: ${error.message}`);
  }

  return data || [];
}

/**
 * Update a member's role (admin/member)
 *
 * Cannot change owner's role. Requires owner to promote to admin.
 *
 * @param teamMemberId - The team member ID
 * @param newRole - The new role ('admin' or 'member')
 *
 * @example
 * await updateMemberRole(teamMemberId, 'admin');
 */
export async function updateMemberRole(
  teamMemberId: string,
  newRole: 'admin' | 'member'
): Promise<void> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromMember(teamMemberId);

  // Get current user's role
  const currentUserRole = await getUserRole(teamId, userId);

  // Get target member's current role
  const { data: targetMember, error: fetchError } = await supabase
    .from('team_members')
    .select('membership_role, user_id')
    .eq('id', teamMemberId)
    .single();

  if (fetchError || !targetMember) {
    throw new NotFoundError('Team member not found');
  }

  // Cannot change owner's role
  if (targetMember.membership_role === 'owner') {
    throw new PermissionError('Cannot change owner role. Use transfer ownership.');
  }

  // Only owner can promote to admin
  if (newRole === 'admin' && currentUserRole !== 'owner') {
    throw new PermissionError('Only owner can promote members to admin');
  }

  // Admins can only demote themselves or other admins to member
  if (currentUserRole === 'admin') {
    if (newRole === 'admin') {
      throw new PermissionError('Only owner can promote to admin');
    }
    // Admin can demote other admins or members
  }

  const { error } = await supabase
    .from('team_members')
    .update({ membership_role: newRole })
    .eq('id', teamMemberId);

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`);
  }
}

/**
 * Remove a member from the team
 *
 * Sets status to inactive (soft delete). Cannot remove owner.
 *
 * @param teamMemberId - The team member ID to remove
 *
 * @example
 * await removeMember(teamMemberId);
 */
export async function removeMember(teamMemberId: string): Promise<void> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromMember(teamMemberId);
  await requireAdmin(teamId, userId);

  // Get target member's role
  const { data: targetMember, error: fetchError } = await supabase
    .from('team_members')
    .select('membership_role, user_id')
    .eq('id', teamMemberId)
    .single();

  if (fetchError || !targetMember) {
    throw new NotFoundError('Team member not found');
  }

  // Cannot remove owner
  if (targetMember.membership_role === 'owner') {
    throw new PermissionError('Cannot remove team owner');
  }

  // Admins cannot remove other admins (only owner can)
  const currentUserRole = await getUserRole(teamId, userId);
  if (currentUserRole === 'admin' && targetMember.membership_role === 'admin') {
    throw new PermissionError('Admins cannot remove other admins');
  }

  const { error } = await supabase
    .from('team_members')
    .update({ status: 'inactive' as MemberStatus })
    .eq('id', teamMemberId);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }
}

/**
 * Update a member's musical roles
 *
 * Replaces all current roles with the new set.
 *
 * @param teamMemberId - The team member ID
 * @param data - Role update data
 *
 * @example
 * await updateMemberRoles(teamMemberId, {
 *   roleIds: [drumsRoleId, vocalsRoleId],
 *   primaryRoleId: drumsRoleId,
 *   proficiencyLevels: {
 *     [drumsRoleId]: 'advanced',
 *     [vocalsRoleId]: 'intermediate'
 *   }
 * });
 */
export async function updateMemberRoles(
  teamMemberId: string,
  data: UpdateMemberRolesData
): Promise<void> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromMember(teamMemberId);

  // Check permissions - user can update own roles, admin can update any
  const { data: targetMember } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('id', teamMemberId)
    .single();

  if (!targetMember) {
    throw new NotFoundError('Team member not found');
  }

  const isOwnRoles = targetMember.user_id === userId;
  if (!isOwnRoles) {
    await requireAdmin(teamId, userId);
  }

  // Validate that all roles belong to this team
  if (data.roleIds.length > 0) {
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .eq('team_id', teamId)
      .in('id', data.roleIds);

    if (rolesError) {
      throw new Error(`Failed to validate roles: ${rolesError.message}`);
    }

    if (!roles || roles.length !== data.roleIds.length) {
      throw new Error('Invalid role ID(s) for this team');
    }
  }

  // Delete existing member roles
  const { error: deleteError } = await supabase
    .from('member_roles')
    .delete()
    .eq('team_member_id', teamMemberId);

  if (deleteError) {
    throw new Error(`Failed to clear existing roles: ${deleteError.message}`);
  }

  // Insert new roles
  if (data.roleIds.length > 0) {
    const memberRoles = data.roleIds.map((roleId) => ({
      team_member_id: teamMemberId,
      role_id: roleId,
      is_primary: roleId === data.primaryRoleId,
      proficiency_level: data.proficiencyLevels?.[roleId] || 'intermediate',
    }));

    const { error: insertError } = await supabase
      .from('member_roles')
      .insert(memberRoles);

    if (insertError) {
      throw new Error(`Failed to assign roles: ${insertError.message}`);
    }
  }
}

/**
 * Add a single role to a member
 *
 * @param teamMemberId - The team member ID
 * @param roleId - The role ID to add
 * @param options - Additional options
 */
export async function addMemberRole(
  teamMemberId: string,
  roleId: string,
  options?: {
    isPrimary?: boolean;
    proficiencyLevel?: ProficiencyLevel;
  }
): Promise<void> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromMember(teamMemberId);

  // Check permissions
  const { data: targetMember } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('id', teamMemberId)
    .single();

  if (!targetMember) {
    throw new NotFoundError('Team member not found');
  }

  const isOwnRoles = targetMember.user_id === userId;
  if (!isOwnRoles) {
    await requireAdmin(teamId, userId);
  }

  // Verify role belongs to team
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('id', roleId)
    .eq('team_id', teamId)
    .single();

  if (!role) {
    throw new NotFoundError('Role not found in this team');
  }

  // Check if already assigned
  const { data: existing } = await supabase
    .from('member_roles')
    .select('id')
    .eq('team_member_id', teamMemberId)
    .eq('role_id', roleId)
    .single();

  if (existing) {
    throw new Error('Member already has this role');
  }

  // If setting as primary, unset other primaries
  if (options?.isPrimary) {
    await supabase
      .from('member_roles')
      .update({ is_primary: false })
      .eq('team_member_id', teamMemberId);
  }

  const { error } = await supabase.from('member_roles').insert({
    team_member_id: teamMemberId,
    role_id: roleId,
    is_primary: options?.isPrimary || false,
    proficiency_level: options?.proficiencyLevel || 'intermediate',
  });

  if (error) {
    throw new Error(`Failed to add role: ${error.message}`);
  }
}

/**
 * Remove a single role from a member
 *
 * @param teamMemberId - The team member ID
 * @param roleId - The role ID to remove
 */
export async function removeMemberRole(
  teamMemberId: string,
  roleId: string
): Promise<void> {
  const userId = await requireAuth();
  const teamId = await getTeamIdFromMember(teamMemberId);

  // Check permissions
  const { data: targetMember } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('id', teamMemberId)
    .single();

  if (!targetMember) {
    throw new NotFoundError('Team member not found');
  }

  const isOwnRoles = targetMember.user_id === userId;
  if (!isOwnRoles) {
    await requireAdmin(teamId, userId);
  }

  const { error } = await supabase
    .from('member_roles')
    .delete()
    .eq('team_member_id', teamMemberId)
    .eq('role_id', roleId);

  if (error) {
    throw new Error(`Failed to remove role: ${error.message}`);
  }
}

/**
 * Update member's nickname in a team
 *
 * @param teamMemberId - The team member ID
 * @param nickname - The new nickname (or null to clear)
 */
export async function updateMemberNickname(
  teamMemberId: string,
  nickname: string | null
): Promise<void> {
  const userId = await requireAuth();

  // Get member to check if it's the current user
  const { data: member } = await supabase
    .from('team_members')
    .select('user_id, team_id')
    .eq('id', teamMemberId)
    .single();

  if (!member) {
    throw new NotFoundError('Team member not found');
  }

  // Users can update their own nickname, admins can update any
  if (member.user_id !== userId) {
    await requireAdmin(member.team_id, userId);
  }

  const { error } = await supabase
    .from('team_members')
    .update({ nickname })
    .eq('id', teamMemberId);

  if (error) {
    throw new Error(`Failed to update nickname: ${error.message}`);
  }
}
