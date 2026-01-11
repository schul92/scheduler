/**
 * useTeams Hook
 *
 * Wrapper around teamStore for accessing and managing teams
 */

import { useCallback, useEffect } from 'react';
import { useTeamStore } from '../store/teamStore';
import { Team, TeamWithMembership } from '../types/database.types';

// ============================================================================
// Types
// ============================================================================

export interface UseTeamsResult {
  /** All teams the user belongs to */
  teams: TeamWithMembership[];
  /** Currently active team */
  activeTeam: TeamWithMembership | null;
  /** Active team ID */
  activeTeamId: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Whether user has any teams */
  hasTeams: boolean;
  /** Switch to a different team */
  switchTeam: (teamId: string) => Promise<void>;
  /** Create a new team */
  createTeam: (name: string, description?: string) => Promise<Team | null>;
  /** Join a team by invite code */
  joinTeamByCode: (inviteCode: string) => Promise<Team | null>;
  /** Leave a team */
  leaveTeam: (teamId: string) => Promise<boolean>;
  /** Delete a team (owner only) */
  deleteTeam: (teamId: string) => Promise<boolean>;
  /** Refresh teams list */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing user's teams
 *
 * Provides access to all teams, active team, and team management functions.
 *
 * @example
 * const { teams, activeTeam, switchTeam, createTeam } = useTeams();
 *
 * // Switch teams
 * await switchTeam(teamId);
 *
 * // Create new team
 * const team = await createTeam('New Team', 'Description');
 */
export function useTeams(): UseTeamsResult {
  const {
    teams,
    activeTeamId,
    isLoading,
    error,
    initialized,
    activeTeam,
    hasTeams,
    fetchTeams,
    setActiveTeam,
    createTeam: storeCreateTeam,
    joinTeamByCode: storeJoinTeamByCode,
    leaveTeam: storeLeaveTeam,
    deleteTeam: storeDeleteTeam,
    initialize,
  } = useTeamStore();

  // Initialize store on mount
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  // Fetch teams when initialized
  useEffect(() => {
    if (initialized && teams.length === 0 && !isLoading) {
      fetchTeams();
    }
  }, [initialized, teams.length, isLoading, fetchTeams]);

  const switchTeam = useCallback(
    async (teamId: string) => {
      await setActiveTeam(teamId);
    },
    [setActiveTeam]
  );

  const createTeam = useCallback(
    async (name: string, description?: string) => {
      return storeCreateTeam(name, description);
    },
    [storeCreateTeam]
  );

  const joinTeamByCode = useCallback(
    async (inviteCode: string) => {
      return storeJoinTeamByCode(inviteCode);
    },
    [storeJoinTeamByCode]
  );

  const leaveTeam = useCallback(
    async (teamId: string) => {
      return storeLeaveTeam(teamId);
    },
    [storeLeaveTeam]
  );

  const deleteTeam = useCallback(
    async (teamId: string) => {
      return storeDeleteTeam(teamId);
    },
    [storeDeleteTeam]
  );

  const refetch = useCallback(async () => {
    await fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    activeTeam: activeTeam(),
    activeTeamId,
    isLoading,
    error,
    hasTeams: hasTeams(),
    switchTeam,
    createTeam,
    joinTeamByCode,
    leaveTeam,
    deleteTeam,
    refetch,
  };
}
