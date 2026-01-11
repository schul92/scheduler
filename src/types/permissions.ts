/**
 * Permissions System
 *
 * Defines role-based permissions for team actions
 */

import { MembershipRole } from './database.types';

// Re-export for convenience
export type { MembershipRole };

// ============================================================================
// Permission Types
// ============================================================================

/**
 * All available permissions in the app
 */
export interface Permissions {
  // Team Management
  /** Can edit team name, description, settings */
  canManageTeam: boolean;
  /** Can delete the team entirely */
  canDeleteTeam: boolean;
  /** Can transfer team ownership to another member */
  canTransferOwnership: boolean;
  /** Can regenerate team invite code */
  canRegenerateInviteCode: boolean;

  // Member Management
  /** Can invite new members */
  canInviteMembers: boolean;
  /** Can remove members from team */
  canRemoveMembers: boolean;
  /** Can change member roles (promote/demote) */
  canManageMembers: boolean;
  /** Can view all team members */
  canViewMembers: boolean;

  // Role Management
  /** Can create/edit/delete musical roles */
  canManageRoles: boolean;
  /** Can assign roles to members */
  canAssignRoles: boolean;

  // Service Management
  /** Can create new services */
  canCreateServices: boolean;
  /** Can edit service details */
  canEditServices: boolean;
  /** Can delete services */
  canDeleteServices: boolean;
  /** Can publish services (make visible to members) */
  canPublishServices: boolean;

  // Assignment Management
  /** Can assign members to service roles */
  canAssignMembers: boolean;
  /** Can respond to their own assignments */
  canRespondToAssignments: boolean;
  /** Can view all assignments */
  canViewAssignments: boolean;

  // Availability
  /** Can set their own availability */
  canSetAvailability: boolean;
  /** Can view other members' availability */
  canViewAvailability: boolean;
}

// ============================================================================
// Role Permission Mappings
// ============================================================================

/**
 * Owner permissions - full access to everything
 */
const OWNER_PERMISSIONS: Permissions = {
  // Team Management
  canManageTeam: true,
  canDeleteTeam: true,
  canTransferOwnership: true,
  canRegenerateInviteCode: true,

  // Member Management
  canInviteMembers: true,
  canRemoveMembers: true,
  canManageMembers: true,
  canViewMembers: true,

  // Role Management
  canManageRoles: true,
  canAssignRoles: true,

  // Service Management
  canCreateServices: true,
  canEditServices: true,
  canDeleteServices: true,
  canPublishServices: true,

  // Assignment Management
  canAssignMembers: true,
  canRespondToAssignments: true,
  canViewAssignments: true,

  // Availability
  canSetAvailability: true,
  canViewAvailability: true,
};

/**
 * Admin permissions - can manage most things but not delete team or transfer ownership
 */
const ADMIN_PERMISSIONS: Permissions = {
  // Team Management
  canManageTeam: true,
  canDeleteTeam: false, // Only owner
  canTransferOwnership: false, // Only owner
  canRegenerateInviteCode: true,

  // Member Management
  canInviteMembers: true,
  canRemoveMembers: true,
  canManageMembers: true, // Can promote to admin, but not owner
  canViewMembers: true,

  // Role Management
  canManageRoles: true,
  canAssignRoles: true,

  // Service Management
  canCreateServices: true,
  canEditServices: true,
  canDeleteServices: true,
  canPublishServices: true,

  // Assignment Management
  canAssignMembers: true,
  canRespondToAssignments: true,
  canViewAssignments: true,

  // Availability
  canSetAvailability: true,
  canViewAvailability: true,
};

/**
 * Member permissions - basic access, can respond to assignments
 */
const MEMBER_PERMISSIONS: Permissions = {
  // Team Management
  canManageTeam: false,
  canDeleteTeam: false,
  canTransferOwnership: false,
  canRegenerateInviteCode: false,

  // Member Management
  canInviteMembers: false,
  canRemoveMembers: false,
  canManageMembers: false,
  canViewMembers: true, // Can see other team members

  // Role Management
  canManageRoles: false,
  canAssignRoles: false,

  // Service Management
  canCreateServices: false,
  canEditServices: false,
  canDeleteServices: false,
  canPublishServices: false,

  // Assignment Management
  canAssignMembers: false,
  canRespondToAssignments: true, // Can respond to their own
  canViewAssignments: true, // Can see service assignments

  // Availability
  canSetAvailability: true, // Can set their own
  canViewAvailability: true, // Can see others' availability
};

/**
 * No permissions - for unauthenticated or non-members
 */
const NO_PERMISSIONS: Permissions = {
  canManageTeam: false,
  canDeleteTeam: false,
  canTransferOwnership: false,
  canRegenerateInviteCode: false,
  canInviteMembers: false,
  canRemoveMembers: false,
  canManageMembers: false,
  canViewMembers: false,
  canManageRoles: false,
  canAssignRoles: false,
  canCreateServices: false,
  canEditServices: false,
  canDeleteServices: false,
  canPublishServices: false,
  canAssignMembers: false,
  canRespondToAssignments: false,
  canViewAssignments: false,
  canSetAvailability: false,
  canViewAvailability: false,
};

/**
 * Mapping of roles to their permissions
 */
export const ROLE_PERMISSIONS: Record<MembershipRole, Permissions> = {
  owner: OWNER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  member: MEMBER_PERMISSIONS,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: MembershipRole | null): Permissions {
  if (!role) {
    return NO_PERMISSIONS;
  }
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: MembershipRole | null,
  permission: keyof Permissions
): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions[permission];
}

/**
 * Check if a role has all specified permissions
 */
export function hasAllPermissions(
  role: MembershipRole | null,
  permissionList: (keyof Permissions)[]
): boolean {
  const permissions = getPermissionsForRole(role);
  return permissionList.every((p) => permissions[p]);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: MembershipRole | null,
  permissionList: (keyof Permissions)[]
): boolean {
  const permissions = getPermissionsForRole(role);
  return permissionList.some((p) => permissions[p]);
}

/**
 * Get a list of all permissions a role has
 */
export function getEnabledPermissions(role: MembershipRole | null): (keyof Permissions)[] {
  const permissions = getPermissionsForRole(role);
  return (Object.keys(permissions) as (keyof Permissions)[]).filter(
    (key) => permissions[key]
  );
}

/**
 * Get a list of all permissions a role doesn't have
 */
export function getDisabledPermissions(role: MembershipRole | null): (keyof Permissions)[] {
  const permissions = getPermissionsForRole(role);
  return (Object.keys(permissions) as (keyof Permissions)[]).filter(
    (key) => !permissions[key]
  );
}

// ============================================================================
// Permission Labels (for UI)
// ============================================================================

/**
 * Human-readable labels for permissions (English)
 */
export const PERMISSION_LABELS_EN: Record<keyof Permissions, string> = {
  canManageTeam: 'Manage Team Settings',
  canDeleteTeam: 'Delete Team',
  canTransferOwnership: 'Transfer Ownership',
  canRegenerateInviteCode: 'Regenerate Invite Code',
  canInviteMembers: 'Invite Members',
  canRemoveMembers: 'Remove Members',
  canManageMembers: 'Manage Member Roles',
  canViewMembers: 'View Members',
  canManageRoles: 'Manage Roles',
  canAssignRoles: 'Assign Roles to Members',
  canCreateServices: 'Create Services',
  canEditServices: 'Edit Services',
  canDeleteServices: 'Delete Services',
  canPublishServices: 'Publish Services',
  canAssignMembers: 'Assign Members to Services',
  canRespondToAssignments: 'Respond to Assignments',
  canViewAssignments: 'View Assignments',
  canSetAvailability: 'Set Availability',
  canViewAvailability: 'View Availability',
};

/**
 * Human-readable labels for permissions (Korean)
 */
export const PERMISSION_LABELS_KO: Record<keyof Permissions, string> = {
  canManageTeam: '팀 설정 관리',
  canDeleteTeam: '팀 삭제',
  canTransferOwnership: '소유권 이전',
  canRegenerateInviteCode: '초대 코드 재생성',
  canInviteMembers: '멤버 초대',
  canRemoveMembers: '멤버 삭제',
  canManageMembers: '멤버 역할 관리',
  canViewMembers: '멤버 보기',
  canManageRoles: '역할 관리',
  canAssignRoles: '멤버에게 역할 할당',
  canCreateServices: '예배 생성',
  canEditServices: '예배 수정',
  canDeleteServices: '예배 삭제',
  canPublishServices: '예배 게시',
  canAssignMembers: '예배에 멤버 배정',
  canRespondToAssignments: '배정 응답',
  canViewAssignments: '배정 보기',
  canSetAvailability: '가능 여부 설정',
  canViewAvailability: '가능 여부 보기',
};

/**
 * Get permission label based on language
 */
export function getPermissionLabel(
  permission: keyof Permissions,
  language: 'en' | 'ko' = 'en'
): string {
  return language === 'ko'
    ? PERMISSION_LABELS_KO[permission]
    : PERMISSION_LABELS_EN[permission];
}

// ============================================================================
// Role Labels (for UI)
// ============================================================================

/**
 * Human-readable labels for roles
 */
export const ROLE_LABELS: Record<MembershipRole, { en: string; ko: string }> = {
  owner: { en: 'Owner', ko: '소유자' },
  admin: { en: 'Admin', ko: '관리자' },
  member: { en: 'Member', ko: '멤버' },
};

/**
 * Get role label based on language
 */
export function getRoleLabel(
  role: MembershipRole,
  language: 'en' | 'ko' = 'en'
): string {
  return ROLE_LABELS[role][language];
}
