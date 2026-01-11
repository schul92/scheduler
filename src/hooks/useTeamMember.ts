/**
 * useTeamMember Hook
 *
 * Returns current user's membership in a specific team
 */

import { useMemo } from 'react';
import { useTeamStore } from '../store/teamStore';
import { TeamWithMembership, MembershipRole } from '../types/database.types';

// ============================================================================
// Types
// ============================================================================

export interface UseTeamMemberResult {
  /** Full membership data for the current user in this team */
  membership: TeamWithMembership | null;
  /** User's role in this team */
  myRole: MembershipRole | null;
  /** Whether user is the owner */
  isOwner: boolean;
  /** Whether user is admin or owner */
  isAdmin: boolean;
  /** Whether user is a member of this team */
  isMember: boolean;
  /** User's team member ID */
  teamMemberId: string | null;
  /** User's nickname in this team */
  nickname: string | null;
  /** When the user joined this team */
  joinedAt: string | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for getting current user's membership info in a specific team
 *
 * @param teamId - The team ID to check membership for
 * @returns Membership info, role, and permission flags
 *
 * @example
 * const { myRole, isOwner, isAdmin } = useTeamMember(teamId);
 *
 * if (!myRole) return <NotAMember />;
 *
 * return (
 *   <View>
 *     <Text>Your role: {myRole}</Text>
 *     {isAdmin && <AdminControls />}
 *   </View>
 * );
 */
export function useTeamMember(teamId: string | null | undefined): UseTeamMemberResult {
  const teams = useTeamStore((state) => state.teams);

  const membership = useMemo(() => {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId) || null;
  }, [teams, teamId]);

  const myRole = membership?.membership_role || null;

  return {
    membership,
    myRole,
    isOwner: myRole === 'owner',
    isAdmin: myRole === 'owner' || myRole === 'admin',
    isMember: myRole !== null,
    teamMemberId: membership?.team_member_id || null,
    nickname: membership?.nickname || null,
    joinedAt: membership?.joined_at || null,
  };
}

/**
 * Hook for getting current user's membership in the active team
 *
 * @returns Membership info for the active team
 *
 * @example
 * const { myRole, isAdmin } = useActiveTeamMember();
 */
export function useActiveTeamMember(): UseTeamMemberResult {
  const activeTeamId = useTeamStore((state) => state.activeTeamId);
  return useTeamMember(activeTeamId);
}
