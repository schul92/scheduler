/**
 * Team Management Store
 *
 * Zustand store for managing teams the user belongs to
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUserId } from '../lib/supabase';
import { withRetry } from '../lib/apiUtils';
import { captureError } from '../lib/sentry';
import {
  Team,
  TeamWithMembership,
  MembershipRole,
  TeamInsert,
  TeamUpdate,
} from '../types/database.types';

// ============================================================================
// Constants
// ============================================================================

const ACTIVE_TEAM_STORAGE_KEY = 'praiseflow_active_team_id';

// ============================================================================
// Types
// ============================================================================

interface TeamState {
  /** All teams the user belongs to */
  teams: TeamWithMembership[];
  /** Currently selected team ID */
  activeTeamId: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Whether the store has been initialized */
  initialized: boolean;
}

interface TeamActions {
  /** Fetch all teams the user belongs to */
  fetchTeams: () => Promise<void>;
  /** Set the active team and persist to storage */
  setActiveTeam: (teamId: string | null) => Promise<void>;
  /** Create a new team (user becomes owner) */
  createTeam: (name: string, description?: string) => Promise<Team | null>;
  /** Update team settings */
  updateTeam: (teamId: string, data: Partial<TeamUpdate>) => Promise<boolean>;
  /** Delete a team (owner only) */
  deleteTeam: (teamId: string) => Promise<boolean>;
  /** Leave a team (not owner) */
  leaveTeam: (teamId: string) => Promise<boolean>;
  /** Join a team by invite code */
  joinTeamByCode: (inviteCode: string) => Promise<Team | null>;
  /** Clear all teams (for logout) */
  clearTeams: () => void;
  /** Initialize store (restore from storage) */
  initialize: () => Promise<void>;
}

interface TeamSelectors {
  /** Get the currently active team */
  activeTeam: () => TeamWithMembership | null;
  /** Get user's role in a specific team */
  getMyRole: (teamId: string) => MembershipRole | null;
  /** Check if user is owner of a team */
  isOwner: (teamId: string) => boolean;
  /** Check if user is admin or owner of a team */
  isAdmin: (teamId: string) => boolean;
  /** Check if user has any teams */
  hasTeams: () => boolean;
}

export type TeamStore = TeamState & TeamActions & TeamSelectors;

// ============================================================================
// Store Implementation
// ============================================================================

export const useTeamStore = create<TeamStore>((set, get) => ({
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  teams: [],
  activeTeamId: null,
  isLoading: false,
  error: null,
  initialized: false,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Initialize the store by restoring activeTeamId from AsyncStorage
   */
  initialize: async () => {
    if (get().initialized) return;

    try {
      const storedTeamId = await AsyncStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);
      if (storedTeamId) {
        set({ activeTeamId: storedTeamId });
      }
      set({ initialized: true });
    } catch (error) {
      console.error('Failed to restore active team:', error);
      set({ initialized: true });
    }
  },

  /**
   * Fetch all teams the user belongs to with their membership info
   * Optimized: Quick count check first, early return for new users
   */
  fetchTeams: async () => {
    // Get session directly to avoid extra async call
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      set({ teams: [], isLoading: false, error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // OPTIMIZATION: Quick count check first - fast for new users with no teams
      const { count, error: countError } = await withRetry(
        async () => {
          const result = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'active');
          if (result.error) throw result.error;
          return result;
        },
        { maxRetries: 3, context: 'fetchTeams:count' }
      );

      // Early return for new users - no need for expensive join
      if (count === 0) {
        console.log('[TeamStore] No teams found for user (fast path)');
        set({ teams: [], isLoading: false });
        return;
      }

      // Only do the join query if user has teams - with retry
      const { data, error } = await withRetry(
        async () => {
          const result = await supabase
            .from('team_members')
            .select(`
              id,
              membership_role,
              status,
              nickname,
              joined_at,
              teams!inner (
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
            `)
            .eq('user_id', userId)
            .eq('status', 'active');
          if (result.error) throw result.error;
          return result;
        },
        { maxRetries: 3, context: 'fetchTeams:query' }
      );

      // Transform data to TeamWithMembership format
      const teamsWithMembership: TeamWithMembership[] = (data || [])
        .filter((item) => item.teams) // Filter out any null teams
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

      set({ teams: teamsWithMembership, isLoading: false });

      // If no active team is set, select the first one
      const { activeTeamId } = get();
      if (!activeTeamId && teamsWithMembership.length > 0) {
        await get().setActiveTeam(teamsWithMembership[0].id);
      }

      // If active team no longer exists, switch to first available
      if (activeTeamId && !teamsWithMembership.find((t) => t.id === activeTeamId)) {
        const newActiveId = teamsWithMembership.length > 0 ? teamsWithMembership[0].id : null;
        await get().setActiveTeam(newActiveId);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      captureError(error instanceof Error ? error : new Error(String(error)), {
        context: 'teamStore:fetchTeams',
        userId,
      });
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
      });
    }
  },

  /**
   * Set the active team and persist to AsyncStorage
   */
  setActiveTeam: async (teamId: string | null) => {
    set({ activeTeamId: teamId });

    try {
      if (teamId) {
        await AsyncStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, teamId);
      } else {
        await AsyncStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to persist active team:', error);
    }
  },

  /**
   * Create a new team (user becomes owner automatically via trigger)
   */
  createTeam: async (name: string, description?: string) => {
    const userId = await getCurrentUserId();
    console.log('[TeamStore] createTeam - userId:', userId);
    if (!userId) {
      set({ error: 'Not authenticated' });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const teamData: TeamInsert = {
        name,
        description: description || null,
        owner_id: userId,
      };
      console.log('[TeamStore] Inserting team:', teamData);

      const { data, error } = await supabase
        .from('teams')
        .insert(teamData)
        .select()
        .single();

      console.log('[TeamStore] Insert result - data:', data, 'error:', error);

      if (error) {
        throw error;
      }

      // Refresh teams list to get the new team with membership info
      await get().fetchTeams();

      // Set the new team as active
      if (data) {
        await get().setActiveTeam(data.id);
      }

      set({ isLoading: false });
      return data;
    } catch (error) {
      console.error('Failed to create team:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create team',
      });
      return null;
    }
  },

  /**
   * Update team settings
   */
  updateTeam: async (teamId: string, data: Partial<TeamUpdate>) => {
    // Check if user has permission
    if (!get().isAdmin(teamId)) {
      set({ error: 'Permission denied: Must be owner or admin' });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase
        .from('teams')
        .update(data)
        .eq('id', teamId);

      if (error) {
        throw error;
      }

      // Update local state
      set((state) => ({
        teams: state.teams.map((team) =>
          team.id === teamId ? { ...team, ...data } : team
        ),
        isLoading: false,
      }));

      return true;
    } catch (error) {
      console.error('Failed to update team:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update team',
      });
      return false;
    }
  },

  /**
   * Delete a team (owner only)
   */
  deleteTeam: async (teamId: string) => {
    // Check if user is owner
    if (!get().isOwner(teamId)) {
      set({ error: 'Permission denied: Only owner can delete team' });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);

      if (error) {
        throw error;
      }

      // Remove from local state
      const remainingTeams = get().teams.filter((t) => t.id !== teamId);
      set({ teams: remainingTeams, isLoading: false });

      // If deleted team was active, switch to another
      if (get().activeTeamId === teamId) {
        const newActiveId = remainingTeams.length > 0 ? remainingTeams[0].id : null;
        await get().setActiveTeam(newActiveId);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete team:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete team',
      });
      return false;
    }
  },

  /**
   * Leave a team (cannot leave if owner)
   */
  leaveTeam: async (teamId: string) => {
    const userId = await getCurrentUserId();
    if (!userId) {
      set({ error: 'Not authenticated' });
      return false;
    }

    // Check if user is owner (cannot leave)
    if (get().isOwner(teamId)) {
      set({ error: 'Owner cannot leave team. Transfer ownership first.' });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Remove from local state
      const remainingTeams = get().teams.filter((t) => t.id !== teamId);
      set({ teams: remainingTeams, isLoading: false });

      // If left team was active, switch to another
      if (get().activeTeamId === teamId) {
        const newActiveId = remainingTeams.length > 0 ? remainingTeams[0].id : null;
        await get().setActiveTeam(newActiveId);
      }

      return true;
    } catch (error) {
      console.error('Failed to leave team:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to leave team',
      });
      return false;
    }
  },

  /**
   * Join a team by invite code
   */
  joinTeamByCode: async (inviteCode: string) => {
    const userId = await getCurrentUserId();
    if (!userId) {
      set({ error: 'Not authenticated' });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      // Find team by invite code
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (teamError || !team) {
        throw new Error('Invalid invite code');
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        throw new Error('Already a member of this team');
      }

      // Add user as member
      const { error: joinError } = await supabase.from('team_members').insert({
        team_id: team.id,
        user_id: userId,
        membership_role: 'member',
        status: 'active',
      });

      if (joinError) {
        throw joinError;
      }

      // Refresh teams and set as active
      await get().fetchTeams();
      await get().setActiveTeam(team.id);

      set({ isLoading: false });
      return team;
    } catch (error) {
      console.error('Failed to join team:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to join team',
      });
      return null;
    }
  },

  /**
   * Clear all teams (for logout)
   */
  clearTeams: () => {
    set({
      teams: [],
      activeTeamId: null,
      isLoading: false,
      error: null,
      initialized: false,
    });
    AsyncStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY).catch(console.error);
  },

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  /**
   * Get the currently active team
   */
  activeTeam: () => {
    const { teams, activeTeamId } = get();
    if (!activeTeamId) return null;
    return teams.find((t) => t.id === activeTeamId) || null;
  },

  /**
   * Get user's role in a specific team
   */
  getMyRole: (teamId: string) => {
    const team = get().teams.find((t) => t.id === teamId);
    return team?.membership_role || null;
  },

  /**
   * Check if user is owner of a team
   */
  isOwner: (teamId: string) => {
    return get().getMyRole(teamId) === 'owner';
  },

  /**
   * Check if user is admin or owner of a team
   */
  isAdmin: (teamId: string) => {
    const role = get().getMyRole(teamId);
    return role === 'owner' || role === 'admin';
  },

  /**
   * Check if user has any teams
   */
  hasTeams: () => {
    return get().teams.length > 0;
  },
}));

// ============================================================================
// Selector Hooks (for convenience)
// ============================================================================

/**
 * Hook to get the active team
 */
export const useActiveTeam = () => useTeamStore((state) => state.activeTeam());

/**
 * Hook to get all teams
 */
export const useTeams = () => useTeamStore((state) => state.teams);

/**
 * Hook to check if user has teams
 */
export const useHasTeams = () => useTeamStore((state) => state.hasTeams());

/**
 * Hook to get loading state
 */
export const useTeamLoading = () => useTeamStore((state) => state.isLoading);

/**
 * Hook to get error state
 */
export const useTeamError = () => useTeamStore((state) => state.error);

/**
 * Hook to check if user is admin of active team
 */
export const useIsActiveTeamAdmin = () => {
  const activeTeamId = useTeamStore((state) => state.activeTeamId);
  const isAdmin = useTeamStore((state) => state.isAdmin);
  return activeTeamId ? isAdmin(activeTeamId) : false;
};

/**
 * Hook to check if user is owner of active team
 */
export const useIsActiveTeamOwner = () => {
  const activeTeamId = useTeamStore((state) => state.activeTeamId);
  const isOwner = useTeamStore((state) => state.isOwner);
  return activeTeamId ? isOwner(activeTeamId) : false;
};
