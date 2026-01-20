/**
 * Availability API
 *
 * API functions for managing member availability
 */

import { supabase, getCurrentUserId } from '../supabase';
import {
  Availability,
  AvailabilityInsert,
  AvailabilityWithUser,
  User,
  MembershipRole,
} from '../../types/database.types';
import { AuthError, PermissionError, NotFoundError } from './teams';

// ============================================================================
// Types
// ============================================================================

/**
 * Availability record for a specific date
 */
export interface AvailabilityRecord {
  id: string;
  date: string;
  is_available: boolean;
  reason: string | null;
  updated_at?: string;
}

/**
 * Input for setting availability
 */
export interface SetAvailabilityData {
  date: string;
  isAvailable: boolean;
  reason?: string;
}

/**
 * Team member availability for a specific date
 */
export interface MemberAvailability {
  team_member_id: string;
  user_id: string;
  user: Pick<User, 'id' | 'full_name' | 'avatar_url'>;
  is_available: boolean;
  has_responded: boolean;  // true if member has submitted availability
  reason: string | null;
}

/**
 * Team availability summary for a date
 */
export interface TeamAvailabilitySummary {
  date: string;
  total_members: number;
  available_count: number;
  unavailable_count: number;
  unknown_count: number;
  members: MemberAvailability[];
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
 * Get user's role in a team
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
 * Verify user is a team member
 */
async function requireMember(teamId: string, userId: string): Promise<void> {
  const role = await getUserRole(teamId, userId);
  if (!role) {
    throw new PermissionError('Not a member of this team');
  }
}

/**
 * Verify user is admin or owner
 */
async function requireAdmin(teamId: string, userId: string): Promise<void> {
  const role = await getUserRole(teamId, userId);
  if (role !== 'owner' && role !== 'admin') {
    throw new PermissionError('Must be owner or admin');
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get current user's availability for a date range in a team
 *
 * @param teamId - The team ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of availability records
 *
 * @example
 * const availability = await getAvailability(teamId, '2024-03-01', '2024-03-31');
 * availability.forEach(a => {
 *   console.log(`${a.date}: ${a.is_available ? 'Available' : 'Unavailable'}`);
 * });
 */
export async function getAvailability(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityRecord[]> {
  const userId = await requireAuth();
  await requireMember(teamId, userId);

  const { data, error } = await supabase
    .from('availability')
    .select('id, date, is_available, reason, updated_at')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch availability: ${error.message}`);
  }

  return data || [];
}

/**
 * Set availability for a specific date
 *
 * Upserts an availability record - creates if doesn't exist, updates if it does.
 *
 * @param teamId - The team ID
 * @param date - The date (YYYY-MM-DD)
 * @param isAvailable - Whether user is available
 * @param reason - Optional reason (especially for unavailability)
 * @returns The created/updated availability record
 *
 * @example
 * // Mark as unavailable with reason
 * await setAvailability(teamId, '2024-03-15', false, 'Out of town');
 *
 * // Mark as available
 * await setAvailability(teamId, '2024-03-16', true);
 */
export async function setAvailability(
  teamId: string,
  date: string,
  isAvailable: boolean,
  reason?: string
): Promise<Availability> {
  const userId = await requireAuth();
  await requireMember(teamId, userId);

  // Check if record exists
  const { data: existing } = await supabase
    .from('availability')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('availability')
      .update({
        is_available: isAvailable,
        reason: reason || null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update availability: ${error.message}`);
    }

    return data;
  } else {
    // Create new record
    const insertData: AvailabilityInsert = {
      team_id: teamId,
      user_id: userId,
      date: date,
      is_available: isAvailable,
      reason: reason || null,
    };

    const { data, error } = await supabase
      .from('availability')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set availability: ${error.message}`);
    }

    return data;
  }
}

/**
 * Set availability for multiple dates at once
 *
 * Efficiently upserts multiple availability records.
 *
 * @param teamId - The team ID
 * @param dates - Array of { date, isAvailable, reason? }
 * @returns Array of created/updated records
 *
 * @example
 * await bulkSetAvailability(teamId, [
 *   { date: '2024-03-15', isAvailable: false },
 *   { date: '2024-03-16', isAvailable: false },
 *   { date: '2024-03-17', isAvailable: true },
 * ]);
 */
export async function bulkSetAvailability(
  teamId: string,
  dates: SetAvailabilityData[]
): Promise<Availability[]> {
  const userId = await requireAuth();
  await requireMember(teamId, userId);

  if (dates.length === 0) {
    return [];
  }

  // Prepare all records for upsert - this is atomic, all succeed or all fail
  const upsertData = dates.map((item) => ({
    team_id: teamId,
    user_id: userId,
    date: item.date,
    is_available: item.isAvailable,
    reason: item.reason || null,
  }));

  // Use upsert with onConflict to handle both inserts and updates atomically
  // The unique constraint on (team_id, user_id, date) allows this to work
  const { data, error } = await supabase
    .from('availability')
    .upsert(upsertData, {
      onConflict: 'team_id,user_id,date',
      ignoreDuplicates: false, // Update existing records
    })
    .select();

  if (error) {
    throw new Error(`Failed to set availability: ${error.message}`);
  }

  return (data || []).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Delete availability record for a specific date
 *
 * Removes the availability entry, returning to "unknown" state.
 *
 * @param teamId - The team ID
 * @param date - The date (YYYY-MM-DD)
 */
export async function deleteAvailability(
  teamId: string,
  date: string
): Promise<void> {
  const userId = await requireAuth();
  await requireMember(teamId, userId);

  const { error } = await supabase
    .from('availability')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('date', date);

  if (error) {
    throw new Error(`Failed to delete availability: ${error.message}`);
  }
}

/**
 * Get all team members' availability for a specific date
 *
 * For leaders to see who's available when planning services.
 * Requires admin or owner role.
 *
 * @param teamId - The team ID
 * @param date - The date (YYYY-MM-DD)
 * @returns Team availability summary with all members
 *
 * @example
 * const summary = await getTeamAvailability(teamId, '2024-03-15');
 * console.log(`${summary.available_count}/${summary.total_members} available`);
 * summary.members.forEach(m => {
 *   console.log(`${m.user.full_name}: ${m.is_available ? 'Yes' : 'No'}`);
 * });
 */
export async function getTeamAvailability(
  teamId: string,
  date: string
): Promise<TeamAvailabilitySummary> {
  const userId = await requireAuth();
  await requireAdmin(teamId, userId);

  // Get all active team members
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select(
      `
      id,
      user_id,
      user:users (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (membersError) {
    throw new Error(`Failed to fetch team members: ${membersError.message}`);
  }

  // Get availability records for this date
  const { data: availabilityRecords, error: availError } = await supabase
    .from('availability')
    .select('user_id, is_available, reason')
    .eq('team_id', teamId)
    .eq('date', date);

  if (availError) {
    throw new Error(`Failed to fetch availability: ${availError.message}`);
  }

  // Create availability map
  const availabilityMap = new Map(
    availabilityRecords?.map((a) => [
      a.user_id,
      { is_available: a.is_available, reason: a.reason },
    ]) || []
  );

  // Build member availability list
  const memberAvailability: MemberAvailability[] = (members || []).map((m) => {
    const avail = availabilityMap.get(m.user_id);
    const hasResponded = avail !== undefined;
    return {
      team_member_id: m.id,
      user_id: m.user_id,
      user: m.user as Pick<User, 'id' | 'full_name' | 'avatar_url'>,
      is_available: avail?.is_available ?? false, // Default to false if not responded
      has_responded: hasResponded, // Track if they've actually responded
      reason: avail?.reason ?? null,
    };
  });

  // Calculate counts
  const total = memberAvailability.length;
  const availableCount = memberAvailability.filter((m) => m.is_available).length;
  const explicitlyUnavailable = availabilityRecords?.filter(
    (a) => !a.is_available
  ).length || 0;
  const unknownCount = total - (availabilityRecords?.length || 0);

  return {
    date,
    total_members: total,
    available_count: availableCount,
    unavailable_count: explicitlyUnavailable,
    unknown_count: unknownCount,
    members: memberAvailability,
  };
}

/**
 * Get team availability for a date range (for calendar view)
 *
 * Returns a summary for each date in the range.
 * Requires admin or owner role.
 *
 * @param teamId - The team ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Map of date to availability counts
 */
export async function getTeamAvailabilityRange(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, { available: number; unavailable: number; total: number }>> {
  const userId = await requireAuth();
  await requireAdmin(teamId, userId);

  // Get member count
  const { count: memberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active');

  const total = memberCount || 0;

  // Get all availability records in range
  const { data: records, error } = await supabase
    .from('availability')
    .select('date, is_available')
    .eq('team_id', teamId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    throw new Error(`Failed to fetch availability: ${error.message}`);
  }

  // Group by date
  const dateMap = new Map<string, { available: number; unavailable: number; total: number }>();

  for (const record of records || []) {
    const existing = dateMap.get(record.date) || { available: 0, unavailable: 0, total };
    if (record.is_available) {
      existing.available++;
    } else {
      existing.unavailable++;
    }
    dateMap.set(record.date, existing);
  }

  return dateMap;
}
