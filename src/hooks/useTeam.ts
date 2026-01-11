/**
 * useTeam Hook
 *
 * Fetches a single team with all members and roles
 */

import { useState, useEffect, useCallback } from 'react';
import { getTeamById, TeamWithMembers } from '../lib/api';
import { TeamMemberWithUser, Role } from '../types/database.types';

// ============================================================================
// Types
// ============================================================================

export interface UseTeamResult {
  /** The team data with all details */
  team: TeamWithMembers | null;
  /** Team members with their user info and roles */
  members: TeamMemberWithUser[];
  /** All roles defined for this team */
  roles: Role[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refetch team data */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching a single team with all members and roles
 *
 * @param teamId - The team ID to fetch
 * @returns Team data, members, roles, loading state, and refetch function
 *
 * @example
 * const { team, members, roles, isLoading, error } = useTeam(teamId);
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error} />;
 *
 * return (
 *   <View>
 *     <Text>{team.name}</Text>
 *     {members.map(m => <MemberRow key={m.id} member={m} />)}
 *   </View>
 * );
 */
export function useTeam(teamId: string | null | undefined): UseTeamResult {
  const [team, setTeam] = useState<TeamWithMembers | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!teamId) {
      setTeam(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getTeamById(teamId);
      setTeam(data);
    } catch (err) {
      console.error('Failed to fetch team:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch team');
      setTeam(null);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  // Fetch on mount and when teamId changes
  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const refetch = useCallback(async () => {
    await fetchTeam();
  }, [fetchTeam]);

  return {
    team,
    members: team?.members || [],
    roles: team?.roles || [],
    isLoading,
    error,
    refetch,
  };
}
