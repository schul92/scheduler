/**
 * PraiseFlow Database Types
 * Auto-generated from Supabase schema with custom helper types
 *
 * @description TypeScript types for all database tables, enums, and common query patterns
 */

// ============================================================================
// JSON Type
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// Database Schema Type
// ============================================================================

export type Database = {
  public: {
    Tables: {
      availability: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          is_available: boolean;
          reason: string | null;
          team_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          is_available?: boolean;
          reason?: string | null;
          team_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          is_available?: boolean;
          reason?: string | null;
          team_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      calendar_sync: {
        Row: {
          created_at: string;
          external_event_id: string;
          id: string;
          last_sync_error: string | null;
          provider: Database['public']['Enums']['calendar_provider_enum'];
          service_assignment_id: string;
          synced_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          external_event_id: string;
          id?: string;
          last_sync_error?: string | null;
          provider: Database['public']['Enums']['calendar_provider_enum'];
          service_assignment_id: string;
          synced_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          external_event_id?: string;
          id?: string;
          last_sync_error?: string | null;
          provider?: Database['public']['Enums']['calendar_provider_enum'];
          service_assignment_id?: string;
          synced_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calendar_sync_service_assignment_id_fkey';
            columns: ['service_assignment_id'];
            isOneToOne: false;
            referencedRelation: 'service_assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calendar_sync_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      member_roles: {
        Row: {
          created_at: string;
          id: string;
          is_primary: boolean;
          notes: string | null;
          proficiency_level: Database['public']['Enums']['proficiency_level_enum'] | null;
          role_id: string;
          team_member_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          proficiency_level?: Database['public']['Enums']['proficiency_level_enum'] | null;
          role_id: string;
          team_member_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          proficiency_level?: Database['public']['Enums']['proficiency_level_enum'] | null;
          role_id?: string;
          team_member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'member_roles_team_member_id_fkey';
            columns: ['team_member_id'];
            isOneToOne: false;
            referencedRelation: 'team_members';
            referencedColumns: ['id'];
          }
        ];
      };
      ownership_transfers: {
        Row: {
          completed_at: string | null;
          created_at: string;
          expires_at: string;
          from_user_id: string;
          id: string;
          initiated_at: string;
          reason: string | null;
          status: Database['public']['Enums']['transfer_status_enum'];
          team_id: string;
          to_user_id: string;
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          from_user_id: string;
          id?: string;
          initiated_at?: string;
          reason?: string | null;
          status?: Database['public']['Enums']['transfer_status_enum'];
          team_id: string;
          to_user_id: string;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          from_user_id?: string;
          id?: string;
          initiated_at?: string;
          reason?: string | null;
          status?: Database['public']['Enums']['transfer_status_enum'];
          team_id?: string;
          to_user_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ownership_transfers_from_user_id_fkey';
            columns: ['from_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ownership_transfers_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ownership_transfers_to_user_id_fkey';
            columns: ['to_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      roles: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          display_order: number | null;
          icon: string | null;
          id: string;
          is_active: boolean;
          max_allowed: number | null;
          min_required: number | null;
          name: string;
          name_ko: string | null;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          max_allowed?: number | null;
          min_required?: number | null;
          name: string;
          name_ko?: string | null;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          max_allowed?: number | null;
          min_required?: number | null;
          name?: string;
          name_ko?: string | null;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roles_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          }
        ];
      };
      service_assignments: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          decline_reason: string | null;
          id: string;
          notes: string | null;
          responded_at: string | null;
          role_id: string;
          service_id: string;
          status: Database['public']['Enums']['assignment_status_enum'];
          team_member_id: string;
          updated_at: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          decline_reason?: string | null;
          id?: string;
          notes?: string | null;
          responded_at?: string | null;
          role_id: string;
          service_id: string;
          status?: Database['public']['Enums']['assignment_status_enum'];
          team_member_id: string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          decline_reason?: string | null;
          id?: string;
          notes?: string | null;
          responded_at?: string | null;
          role_id?: string;
          service_id?: string;
          status?: Database['public']['Enums']['assignment_status_enum'];
          team_member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_assignments_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_assignments_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_assignments_team_member_id_fkey';
            columns: ['team_member_id'];
            isOneToOne: false;
            referencedRelation: 'team_members';
            referencedColumns: ['id'];
          }
        ];
      };
      services: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          end_time: string | null;
          id: string;
          location: string | null;
          name: string;
          notes: string | null;
          published_at: string | null;
          rehearsal_date: string | null;
          rehearsal_time: string | null;
          service_date: string;
          start_time: string;
          status: Database['public']['Enums']['service_status_enum'];
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          location?: string | null;
          name: string;
          notes?: string | null;
          published_at?: string | null;
          rehearsal_date?: string | null;
          rehearsal_time?: string | null;
          service_date: string;
          start_time: string;
          status?: Database['public']['Enums']['service_status_enum'];
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          location?: string | null;
          name?: string;
          notes?: string | null;
          published_at?: string | null;
          rehearsal_date?: string | null;
          rehearsal_time?: string | null;
          service_date?: string;
          start_time?: string;
          status?: Database['public']['Enums']['service_status_enum'];
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'services_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          }
        ];
      };
      team_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string | null;
          expires_at: string;
          id: string;
          invited_by: string;
          message: string | null;
          phone: string | null;
          role_suggestion: Database['public']['Enums']['membership_role_enum'] | null;
          status: Database['public']['Enums']['invitation_status_enum'];
          team_id: string;
          token: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by: string;
          message?: string | null;
          phone?: string | null;
          role_suggestion?: Database['public']['Enums']['membership_role_enum'] | null;
          status?: Database['public']['Enums']['invitation_status_enum'];
          team_id: string;
          token?: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          message?: string | null;
          phone?: string | null;
          role_suggestion?: Database['public']['Enums']['membership_role_enum'] | null;
          status?: Database['public']['Enums']['invitation_status_enum'];
          team_id?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_invitations_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          }
        ];
      };
      team_members: {
        Row: {
          created_at: string;
          id: string;
          joined_at: string;
          membership_role: Database['public']['Enums']['membership_role_enum'];
          nickname: string | null;
          notifications_enabled: boolean;
          parts: string[] | null;
          status: Database['public']['Enums']['member_status_enum'];
          team_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          joined_at?: string;
          membership_role?: Database['public']['Enums']['membership_role_enum'];
          nickname?: string | null;
          notifications_enabled?: boolean;
          parts?: string[] | null;
          status?: Database['public']['Enums']['member_status_enum'];
          team_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          joined_at?: string;
          membership_role?: Database['public']['Enums']['membership_role_enum'];
          nickname?: string | null;
          notifications_enabled?: boolean;
          parts?: string[] | null;
          status?: Database['public']['Enums']['member_status_enum'];
          team_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      teams: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          id: string;
          invite_code: string | null;
          name: string;
          owner_id: string;
          settings: Json | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          invite_code?: string | null;
          name: string;
          owner_id: string;
          settings?: Json | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          invite_code?: string | null;
          name?: string;
          owner_id?: string;
          settings?: Json | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          device_type: string | null;
          email: string;
          full_name: string | null;
          id: string;
          kakao_id: string | null;
          phone: string | null;
          preferred_language: string | null;
          push_token: string | null;
          push_token_updated_at: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          device_type?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          kakao_id?: string | null;
          phone?: string | null;
          preferred_language?: string | null;
          push_token?: string | null;
          push_token_updated_at?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          device_type?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          kakao_id?: string | null;
          phone?: string | null;
          preferred_language?: string | null;
          push_token?: string | null;
          push_token_updated_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      transfer_team_ownership: {
        Args: {
          p_team_id: string;
          p_new_owner_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      assignment_status_enum: 'pending' | 'confirmed' | 'declined';
      calendar_provider_enum: 'google' | 'apple' | 'outlook';
      invitation_status_enum: 'pending' | 'accepted' | 'expired' | 'cancelled';
      member_status_enum: 'active' | 'inactive' | 'pending';
      membership_role_enum: 'owner' | 'admin' | 'member';
      proficiency_level_enum: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      service_status_enum: 'draft' | 'published' | 'completed' | 'cancelled';
      transfer_status_enum: 'pending' | 'completed' | 'cancelled' | 'expired';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ============================================================================
// Supabase Type Helpers
// ============================================================================

type PublicSchema = Database['public'];

/**
 * Get the Row type for a table
 * @example Tables<'users'> // Returns the users Row type
 */
export type Tables<
  TableName extends keyof PublicSchema['Tables']
> = PublicSchema['Tables'][TableName]['Row'];

/**
 * Get the Insert type for a table
 * @example TablesInsert<'users'> // Returns the users Insert type
 */
export type TablesInsert<
  TableName extends keyof PublicSchema['Tables']
> = PublicSchema['Tables'][TableName]['Insert'];

/**
 * Get the Update type for a table
 * @example TablesUpdate<'users'> // Returns the users Update type
 */
export type TablesUpdate<
  TableName extends keyof PublicSchema['Tables']
> = PublicSchema['Tables'][TableName]['Update'];

/**
 * Get an Enum type
 * @example Enums<'membership_role_enum'> // Returns 'owner' | 'admin' | 'member'
 */
export type Enums<
  EnumName extends keyof PublicSchema['Enums']
> = PublicSchema['Enums'][EnumName];

// ============================================================================
// Enum Type Aliases (for convenience)
// ============================================================================

/** Permission level within a team */
export type MembershipRole = Enums<'membership_role_enum'>;

/** Team member status */
export type MemberStatus = Enums<'member_status_enum'>;

/** Service/event status */
export type ServiceStatus = Enums<'service_status_enum'>;

/** Assignment response status */
export type AssignmentStatus = Enums<'assignment_status_enum'>;

/** Invitation status */
export type InvitationStatus = Enums<'invitation_status_enum'>;

/** Ownership transfer status */
export type TransferStatus = Enums<'transfer_status_enum'>;

/** Proficiency level for musical roles */
export type ProficiencyLevel = Enums<'proficiency_level_enum'>;

/** Calendar sync provider */
export type CalendarProvider = Enums<'calendar_provider_enum'>;

// ============================================================================
// Row Type Aliases (for convenience)
// ============================================================================

export type User = Tables<'users'>;
export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;
export type Role = Tables<'roles'>;
export type MemberRole = Tables<'member_roles'>;
export type Service = Tables<'services'>;
export type ServiceAssignment = Tables<'service_assignments'>;
export type Availability = Tables<'availability'>;
export type TeamInvitation = Tables<'team_invitations'>;
export type OwnershipTransfer = Tables<'ownership_transfers'>;
export type CalendarSync = Tables<'calendar_sync'>;

// ============================================================================
// Insert Type Aliases
// ============================================================================

export type UserInsert = TablesInsert<'users'>;
export type TeamInsert = TablesInsert<'teams'>;
export type TeamMemberInsert = TablesInsert<'team_members'>;
export type RoleInsert = TablesInsert<'roles'>;
export type MemberRoleInsert = TablesInsert<'member_roles'>;
export type ServiceInsert = TablesInsert<'services'>;
export type ServiceAssignmentInsert = TablesInsert<'service_assignments'>;
export type AvailabilityInsert = TablesInsert<'availability'>;
export type TeamInvitationInsert = TablesInsert<'team_invitations'>;
export type OwnershipTransferInsert = TablesInsert<'ownership_transfers'>;
export type CalendarSyncInsert = TablesInsert<'calendar_sync'>;

// ============================================================================
// Update Type Aliases
// ============================================================================

export type UserUpdate = TablesUpdate<'users'>;
export type TeamUpdate = TablesUpdate<'teams'>;
export type TeamMemberUpdate = TablesUpdate<'team_members'>;
export type RoleUpdate = TablesUpdate<'roles'>;
export type MemberRoleUpdate = TablesUpdate<'member_roles'>;
export type ServiceUpdate = TablesUpdate<'services'>;
export type ServiceAssignmentUpdate = TablesUpdate<'service_assignments'>;
export type AvailabilityUpdate = TablesUpdate<'availability'>;
export type TeamInvitationUpdate = TablesUpdate<'team_invitations'>;
export type OwnershipTransferUpdate = TablesUpdate<'ownership_transfers'>;
export type CalendarSyncUpdate = TablesUpdate<'calendar_sync'>;

// ============================================================================
// Team Settings Type
// ============================================================================

/**
 * Type-safe team settings object
 */
export interface TeamSettings {
  /** Default service duration in minutes */
  default_service_duration: number;
  /** Hours before service to send reminder */
  reminder_hours_before: number;
  /** Allow members to swap assignments */
  allow_member_swap: boolean;
  /** Require reason when declining assignment */
  require_decline_reason: boolean;
  /** Auto-publish services when created */
  auto_publish_services: boolean;
}

// ============================================================================
// Helper Types for Common Query Patterns
// ============================================================================

/**
 * Team with the current user's membership info
 * Used for displaying team list with user's role in each team
 */
export interface TeamWithMembership extends Team {
  /** User's membership role in this team */
  membership_role: MembershipRole;
  /** User's membership status */
  membership_status: MemberStatus;
  /** User's team member ID */
  team_member_id: string;
  /** When the user joined */
  joined_at: string;
  /** User's nickname in this team (if set) */
  nickname: string | null;
}

/**
 * Team member with user details and their musical roles
 * Used for displaying team roster
 */
export interface TeamMemberWithUser extends TeamMember {
  /** The user's profile */
  user: User;
  /** Musical roles this member can play */
  member_roles: (MemberRole & {
    /** The role details */
    role: Role;
  })[];
}

/**
 * Role with assigned members count
 * Used for role management views
 */
export interface RoleWithStats extends Role {
  /** Number of members who can play this role */
  member_count: number;
  /** Number of members with this as primary role */
  primary_count: number;
}

/**
 * Service with all assignment details
 * Used for schedule view and service management
 */
export interface ServiceWithAssignments extends Service {
  /** The team this service belongs to */
  team: Team;
  /** All role assignments for this service */
  assignments: (ServiceAssignment & {
    /** The team member assigned */
    team_member: TeamMember & {
      /** The user details */
      user: User;
    };
    /** The role they're assigned to */
    role: Role;
  })[];
  /** Creator user details */
  created_by_user: User | null;
}

/**
 * Assignment with full context
 * Used for assignment response views
 */
export interface AssignmentWithContext extends ServiceAssignment {
  /** The service details */
  service: Service & {
    /** Team name for display */
    team: Pick<Team, 'id' | 'name' | 'color'>;
  };
  /** The role details */
  role: Role;
}

/**
 * Personal calendar entry for unified calendar view
 * Combines services across all user's teams
 */
export interface PersonalCalendarEntry {
  /** Unique identifier */
  id: string;
  /** Entry type */
  type: 'service' | 'rehearsal' | 'availability';
  /** Title for display */
  title: string;
  /** Date of the entry */
  date: string;
  /** Start time (if applicable) */
  start_time: string | null;
  /** End time (if applicable) */
  end_time: string | null;
  /** Team info */
  team: Pick<Team, 'id' | 'name' | 'color'>;
  /** Service info (if type is service or rehearsal) */
  service?: Pick<Service, 'id' | 'name' | 'status' | 'location'>;
  /** User's assignment for this service (if any) */
  assignment?: {
    id: string;
    status: AssignmentStatus;
    role: Pick<Role, 'id' | 'name' | 'name_ko' | 'color'>;
  };
  /** Availability info (if type is availability) */
  availability?: {
    is_available: boolean;
    reason: string | null;
  };
}

/**
 * Invitation with team details
 * Used for displaying pending invitations
 */
export interface InvitationWithTeam extends TeamInvitation {
  /** The team being invited to */
  team: Pick<Team, 'id' | 'name' | 'color' | 'description'>;
  /** The user who sent the invitation */
  invited_by_user: Pick<User, 'id' | 'full_name' | 'avatar_url'>;
}

/**
 * Availability with user info
 * Used for team availability calendar
 */
export interface AvailabilityWithUser extends Availability {
  /** The user's details */
  user: Pick<User, 'id' | 'full_name' | 'avatar_url'>;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Form Data Types
// ============================================================================

/**
 * Create team form data
 */
export interface CreateTeamData {
  name: string;
  description?: string;
  color?: string;
  timezone?: string;
}

/**
 * Create service form data
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
}

/**
 * Update profile form data
 */
export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  preferred_language?: 'en' | 'ko';
  avatar_url?: string;
  kakao_id?: string;
}

/**
 * Assignment response data
 */
export interface AssignmentResponseData {
  status: 'confirmed' | 'declined';
  decline_reason?: string;
}

// ============================================================================
// Enum Constants (for runtime validation and iteration)
// ============================================================================

export const MEMBERSHIP_ROLES: MembershipRole[] = ['owner', 'admin', 'member'];
export const MEMBER_STATUSES: MemberStatus[] = ['active', 'inactive', 'pending'];
export const SERVICE_STATUSES: ServiceStatus[] = ['draft', 'published', 'completed', 'cancelled'];
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['pending', 'confirmed', 'declined'];
export const INVITATION_STATUSES: InvitationStatus[] = ['pending', 'accepted', 'expired', 'cancelled'];
export const TRANSFER_STATUSES: TransferStatus[] = ['pending', 'completed', 'cancelled', 'expired'];
export const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
export const CALENDAR_PROVIDERS: CalendarProvider[] = ['google', 'apple', 'outlook'];

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if a role has admin-level permissions
 */
export function isAdmin(role: MembershipRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Check if a role is the owner
 */
export function isOwner(role: MembershipRole): boolean {
  return role === 'owner';
}

/**
 * Get role display priority (for sorting)
 */
export function getRolePriority(role: MembershipRole): number {
  switch (role) {
    case 'owner':
      return 0;
    case 'admin':
      return 1;
    case 'member':
      return 2;
    default:
      return 99;
  }
}
