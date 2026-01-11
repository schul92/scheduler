/**
 * PermissionGate Component
 *
 * Conditionally renders children based on user permissions
 */

import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePermissions } from '../../hooks/usePermissions';
import { Permissions } from '../../types/permissions';

// ============================================================================
// Types
// ============================================================================

export interface PermissionGateProps {
  /** The permission(s) required to render children */
  permission: keyof Permissions | (keyof Permissions)[];
  /** Team ID to check permission for (optional, uses active team if not provided) */
  teamId?: string;
  /** Whether all permissions are required (default: true) or just any */
  requireAll?: boolean;
  /** Content to render if user has permission */
  children: ReactNode;
  /** Optional fallback to render if user doesn't have permission */
  fallback?: ReactNode;
  /** Show nothing instead of fallback (default: true if no fallback provided) */
  hideIfDenied?: boolean;
}

export interface AdminGateProps {
  /** Team ID to check (optional, uses active team if not provided) */
  teamId?: string;
  /** Content to render if user is admin or owner */
  children: ReactNode;
  /** Optional fallback to render if user is not admin */
  fallback?: ReactNode;
}

export interface OwnerGateProps {
  /** Team ID to check (optional, uses active team if not provided) */
  teamId?: string;
  /** Content to render if user is owner */
  children: ReactNode;
  /** Optional fallback to render if user is not owner */
  fallback?: ReactNode;
}

export interface MemberGateProps {
  /** Team ID to check (optional, uses active team if not provided) */
  teamId?: string;
  /** Content to render if user is a member */
  children: ReactNode;
  /** Optional fallback to render if user is not a member */
  fallback?: ReactNode;
}

// ============================================================================
// PermissionGate Component
// ============================================================================

/**
 * Gate component that only renders children if user has the required permission(s)
 *
 * @example
 * // Single permission
 * <PermissionGate permission="canCreateServices">
 *   <CreateServiceButton />
 * </PermissionGate>
 *
 * @example
 * // Multiple permissions (all required)
 * <PermissionGate permission={['canEditServices', 'canDeleteServices']}>
 *   <ServiceActions />
 * </PermissionGate>
 *
 * @example
 * // Multiple permissions (any one)
 * <PermissionGate permission={['canEditServices', 'canDeleteServices']} requireAll={false}>
 *   <ServiceActions />
 * </PermissionGate>
 *
 * @example
 * // With fallback
 * <PermissionGate permission="canManageTeam" fallback={<ReadOnlyView />}>
 *   <EditableView />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  teamId,
  requireAll = true,
  children,
  fallback,
  hideIfDenied = !fallback,
}: PermissionGateProps): React.ReactElement | null {
  const { can, canAll, canAny, isLoading } = usePermissions(teamId);

  // Show nothing while loading
  if (isLoading) {
    return null;
  }

  // Check permissions
  const hasPermission = Array.isArray(permission)
    ? requireAll
      ? canAll(permission)
      : canAny(permission)
    : can(permission);

  // Render based on permission
  if (hasPermission) {
    return <>{children}</>;
  }

  // No permission - show fallback or nothing
  if (hideIfDenied) {
    return null;
  }

  return <>{fallback}</>;
}

// ============================================================================
// Convenience Gate Components
// ============================================================================

/**
 * Gate that only renders for admins (owner or admin role)
 *
 * @example
 * <AdminGate>
 *   <AdminPanel />
 * </AdminGate>
 */
export function AdminGate({
  teamId,
  children,
  fallback,
}: AdminGateProps): React.ReactElement | null {
  const { isAdmin, isLoading } = usePermissions(teamId);

  if (isLoading) {
    return null;
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

/**
 * Gate that only renders for the team owner
 *
 * @example
 * <OwnerGate>
 *   <TransferOwnershipButton />
 * </OwnerGate>
 */
export function OwnerGate({
  teamId,
  children,
  fallback,
}: OwnerGateProps): React.ReactElement | null {
  const { isOwner, isLoading } = usePermissions(teamId);

  if (isLoading) {
    return null;
  }

  if (isOwner) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

/**
 * Gate that only renders for team members
 *
 * @example
 * <MemberGate fallback={<JoinTeamPrompt />}>
 *   <TeamContent />
 * </MemberGate>
 */
export function MemberGate({
  teamId,
  children,
  fallback,
}: MemberGateProps): React.ReactElement | null {
  const { isMember, isLoading } = usePermissions(teamId);

  if (isLoading) {
    return null;
  }

  if (isMember) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

// ============================================================================
// Permission Denied Component
// ============================================================================

export interface PermissionDeniedProps {
  /** Title to display */
  title?: string;
  /** Message to display */
  message?: string;
}

/**
 * Default component to show when permission is denied
 *
 * @example
 * <PermissionGate
 *   permission="canManageTeam"
 *   fallback={<PermissionDenied title="Access Denied" message="You need admin access" />}
 * >
 *   <AdminContent />
 * </PermissionGate>
 */
export function PermissionDenied({
  title = 'Access Denied',
  message = "You don't have permission to view this content.",
}: PermissionDeniedProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

// ============================================================================
// Default Export
// ============================================================================

export default PermissionGate;
