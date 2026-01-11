/**
 * usePermissions Hook
 *
 * Hook for checking user permissions within a team
 */

import { useMemo } from 'react';
import { useTeamStore } from '../store/teamStore';
import {
  Permissions,
  MembershipRole,
  getPermissionsForRole,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from '../types/permissions';

// ============================================================================
// Types
// ============================================================================

export interface UsePermissionsResult {
  /** All permissions for the user in this team */
  permissions: Permissions;
  /** User's role in this team */
  role: MembershipRole | null;
  /** Whether permissions are still loading */
  isLoading: boolean;
  /** Check if user has a specific permission */
  can: (permission: keyof Permissions) => boolean;
  /** Check if user has all specified permissions */
  canAll: (permissions: (keyof Permissions)[]) => boolean;
  /** Check if user has any of the specified permissions */
  canAny: (permissions: (keyof Permissions)[]) => boolean;
  /** Whether user is an admin (owner or admin role) */
  isAdmin: boolean;
  /** Whether user is the owner */
  isOwner: boolean;
  /** Whether user is a member of this team */
  isMember: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to get permissions for a specific team
 *
 * @param teamId - The team ID to check permissions for (optional, uses active team if not provided)
 * @returns Permissions object and helper functions
 *
 * @example
 * // Using active team
 * const { can, isAdmin } = usePermissions();
 * if (can('canCreateServices')) {
 *   // Show create button
 * }
 *
 * @example
 * // Using specific team
 * const { permissions } = usePermissions(teamId);
 * if (permissions.canManageTeam) {
 *   // Show settings
 * }
 */
export function usePermissions(teamId?: string): UsePermissionsResult {
  const {
    activeTeamId,
    getMyRole,
    isLoading,
    isOwner: checkIsOwner,
    isAdmin: checkIsAdmin,
  } = useTeamStore();

  // Use provided teamId or fall back to active team
  const effectiveTeamId = teamId || activeTeamId;

  // Get user's role in this team
  const role = useMemo(() => {
    if (!effectiveTeamId) return null;
    return getMyRole(effectiveTeamId);
  }, [effectiveTeamId, getMyRole]);

  // Get permissions for the role
  const permissions = useMemo(() => {
    return getPermissionsForRole(role);
  }, [role]);

  // Helper function to check a single permission
  const can = useMemo(() => {
    return (permission: keyof Permissions) => hasPermission(role, permission);
  }, [role]);

  // Helper function to check multiple permissions (all must be true)
  const canAll = useMemo(() => {
    return (permissionList: (keyof Permissions)[]) =>
      hasAllPermissions(role, permissionList);
  }, [role]);

  // Helper function to check multiple permissions (any must be true)
  const canAny = useMemo(() => {
    return (permissionList: (keyof Permissions)[]) =>
      hasAnyPermission(role, permissionList);
  }, [role]);

  // Computed values
  const isOwner = effectiveTeamId ? checkIsOwner(effectiveTeamId) : false;
  const isAdmin = effectiveTeamId ? checkIsAdmin(effectiveTeamId) : false;
  const isMember = role !== null;

  return {
    permissions,
    role,
    isLoading,
    can,
    canAll,
    canAny,
    isAdmin,
    isOwner,
    isMember,
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook to check if user can perform a specific action
 *
 * @example
 * const canCreate = useCanPerform('canCreateServices');
 */
export function useCanPerform(
  permission: keyof Permissions,
  teamId?: string
): boolean {
  const { can } = usePermissions(teamId);
  return can(permission);
}

/**
 * Hook to check if user is admin of a team
 *
 * @example
 * const isAdmin = useIsTeamAdmin(teamId);
 */
export function useIsTeamAdmin(teamId?: string): boolean {
  const { isAdmin } = usePermissions(teamId);
  return isAdmin;
}

/**
 * Hook to check if user is owner of a team
 *
 * @example
 * const isOwner = useIsTeamOwner(teamId);
 */
export function useIsTeamOwner(teamId?: string): boolean {
  const { isOwner } = usePermissions(teamId);
  return isOwner;
}

/**
 * Hook to get user's role in a team
 *
 * @example
 * const role = useMyRole(teamId);
 * // role: 'owner' | 'admin' | 'member' | null
 */
export function useMyRole(teamId?: string): MembershipRole | null {
  const { role } = usePermissions(teamId);
  return role;
}

// ============================================================================
// Default Export
// ============================================================================

export default usePermissions;
