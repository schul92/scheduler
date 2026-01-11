/**
 * Calendar API
 *
 * API functions for calendar views and synchronization
 */

import { supabase, getCurrentUserId } from '../supabase';
import {
  PersonalCalendarEntry,
  Service,
  ServiceStatus,
  AssignmentStatus,
  CalendarProvider,
  CalendarSync,
  CalendarSyncInsert,
  Team,
  Role,
} from '../../types/database.types';
import { AuthError } from './teams';

// ============================================================================
// Types
// ============================================================================

/**
 * Upcoming service for dashboard
 */
export interface UpcomingService {
  id: string;
  name: string;
  service_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: ServiceStatus;
  team: Pick<Team, 'id' | 'name' | 'color'>;
  my_assignment?: {
    id: string;
    status: AssignmentStatus;
    role: Pick<Role, 'id' | 'name' | 'name_ko' | 'color'>;
  };
}

/**
 * ICS event for calendar export
 */
export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: string;
  dtend?: string;
  categories?: string[];
}

/**
 * Calendar sync record with service details
 */
export interface CalendarSyncWithDetails extends CalendarSync {
  service_assignment: {
    id: string;
    service: Pick<Service, 'id' | 'name' | 'service_date' | 'start_time'>;
    role: Pick<Role, 'id' | 'name'>;
  };
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
 * Format date and time for ICS format (YYYYMMDDTHHMMSS)
 */
function formatICSDateTime(date: string, time: string): string {
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  return `${year}${month}${day}T${hour}${minute}00`;
}

/**
 * Format date for ICS (YYYYMMDD)
 */
function formatICSDate(date: string): string {
  return date.replace(/-/g, '');
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get personal calendar entries across all teams
 *
 * Returns all services, rehearsals, and availability for the current user.
 * Used for the unified personal calendar view.
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of calendar entries
 *
 * @example
 * const entries = await getPersonalCalendar('2024-03-01', '2024-03-31');
 * entries.forEach(entry => {
 *   console.log(`${entry.date}: ${entry.title} (${entry.team.name})`);
 * });
 */
export async function getPersonalCalendar(
  startDate: string,
  endDate: string
): Promise<PersonalCalendarEntry[]> {
  const userId = await requireAuth();

  // Get user's team memberships
  const { data: memberships } = await supabase
    .from('team_members')
    .select('id, team_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const teamIds = memberships.map((m) => m.team_id);
  const teamMemberIds = memberships.map((m) => m.id);

  const entries: PersonalCalendarEntry[] = [];

  // Get services with user's assignments
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select(
      `
      id,
      name,
      description,
      service_date,
      start_time,
      end_time,
      location,
      status,
      rehearsal_date,
      rehearsal_time,
      team:teams (
        id,
        name,
        color
      ),
      assignments:service_assignments!inner (
        id,
        status,
        team_member_id,
        role:roles (
          id,
          name,
          name_ko,
          color
        )
      )
    `
    )
    .in('team_id', teamIds)
    .in('status', ['published', 'completed'])
    .gte('service_date', startDate)
    .lte('service_date', endDate)
    .order('service_date', { ascending: true });

  if (servicesError) {
    throw new Error(`Failed to fetch services: ${servicesError.message}`);
  }

  // Process services
  for (const service of services || []) {
    // Filter assignments to only user's
    const myAssignments = (service.assignments || []).filter((a: any) =>
      teamMemberIds.includes(a.team_member_id)
    );

    if (myAssignments.length > 0) {
      for (const assignment of myAssignments) {
        entries.push({
          id: `service-${service.id}-${assignment.id}`,
          type: 'service',
          title: service.name,
          date: service.service_date,
          start_time: service.start_time,
          end_time: service.end_time,
          team: service.team as Pick<Team, 'id' | 'name' | 'color'>,
          service: {
            id: service.id,
            name: service.name,
            status: service.status,
            location: service.location,
          },
          assignment: {
            id: assignment.id,
            status: assignment.status,
            role: assignment.role as Pick<Role, 'id' | 'name' | 'name_ko' | 'color'>,
          },
        });

        // Add rehearsal if exists
        if (service.rehearsal_date) {
          entries.push({
            id: `rehearsal-${service.id}-${assignment.id}`,
            type: 'rehearsal',
            title: `Rehearsal: ${service.name}`,
            date: service.rehearsal_date,
            start_time: service.rehearsal_time,
            end_time: null,
            team: service.team as Pick<Team, 'id' | 'name' | 'color'>,
            service: {
              id: service.id,
              name: service.name,
              status: service.status,
              location: service.location,
            },
            assignment: {
              id: assignment.id,
              status: assignment.status,
              role: assignment.role as Pick<Role, 'id' | 'name' | 'name_ko' | 'color'>,
            },
          });
        }
      }
    }
  }

  // Get availability records
  const { data: availability, error: availError } = await supabase
    .from('availability')
    .select(
      `
      id,
      date,
      is_available,
      reason,
      team:teams (
        id,
        name,
        color
      )
    `
    )
    .eq('user_id', userId)
    .in('team_id', teamIds)
    .gte('date', startDate)
    .lte('date', endDate);

  if (availError) {
    throw new Error(`Failed to fetch availability: ${availError.message}`);
  }

  // Add availability entries (only unavailable ones are notable)
  for (const avail of availability || []) {
    if (!avail.is_available) {
      entries.push({
        id: `availability-${avail.id}`,
        type: 'availability',
        title: 'Unavailable',
        date: avail.date,
        start_time: null,
        end_time: null,
        team: avail.team as Pick<Team, 'id' | 'name' | 'color'>,
        availability: {
          is_available: avail.is_available,
          reason: avail.reason,
        },
      });
    }
  }

  // Sort by date and time
  return entries.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    if (!a.start_time && !b.start_time) return 0;
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });
}

/**
 * Get upcoming services for the dashboard
 *
 * Returns the next N services across all user's teams.
 *
 * @param limit - Maximum number of services to return (default: 5)
 * @returns Array of upcoming services
 *
 * @example
 * const upcoming = await getUpcomingServices(10);
 * upcoming.forEach(s => {
 *   console.log(`${s.service_date}: ${s.name} at ${s.team.name}`);
 * });
 */
export async function getUpcomingServices(
  limit: number = 5
): Promise<UpcomingService[]> {
  const userId = await requireAuth();

  // Get user's team memberships
  const { data: memberships } = await supabase
    .from('team_members')
    .select('id, team_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const teamIds = memberships.map((m) => m.team_id);
  const teamMemberIds = memberships.map((m) => m.id);

  const today = new Date().toISOString().split('T')[0];

  // Get upcoming services
  const { data: services, error } = await supabase
    .from('services')
    .select(
      `
      id,
      name,
      service_date,
      start_time,
      end_time,
      location,
      status,
      team:teams (
        id,
        name,
        color
      ),
      assignments:service_assignments (
        id,
        status,
        team_member_id,
        role:roles (
          id,
          name,
          name_ko,
          color
        )
      )
    `
    )
    .in('team_id', teamIds)
    .in('status', ['published'])
    .gte('service_date', today)
    .order('service_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch upcoming services: ${error.message}`);
  }

  // Transform and filter assignments
  return (services || []).map((service) => {
    const myAssignment = (service.assignments || []).find((a: any) =>
      teamMemberIds.includes(a.team_member_id)
    ) as any;

    return {
      id: service.id,
      name: service.name,
      service_date: service.service_date,
      start_time: service.start_time,
      end_time: service.end_time,
      location: service.location,
      status: service.status,
      team: service.team as Pick<Team, 'id' | 'name' | 'color'>,
      my_assignment: myAssignment
        ? {
            id: myAssignment.id,
            status: myAssignment.status,
            role: myAssignment.role as Pick<Role, 'id' | 'name' | 'name_ko' | 'color'>,
          }
        : undefined,
    };
  });
}

/**
 * Generate ICS (iCalendar) file content
 *
 * Creates a properly formatted ICS file from calendar entries.
 *
 * @param entries - Array of calendar entries to export
 * @param calendarName - Name for the calendar
 * @returns ICS file content as string
 *
 * @example
 * const entries = await getPersonalCalendar('2024-03-01', '2024-03-31');
 * const icsContent = generateICS(entries, 'My Worship Schedule');
 * // Save or download icsContent
 */
export function generateICS(
  entries: PersonalCalendarEntry[],
  calendarName: string = 'PraiseFlow Schedule'
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PraiseFlow//Schedule//EN',
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const entry of entries) {
    if (entry.type === 'availability') {
      // Skip availability entries for ICS export
      continue;
    }

    const uid = `${entry.id}@praiseflow.app`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`SUMMARY:${escapeICS(entry.title)}`);

    if (entry.start_time) {
      lines.push(`DTSTART:${formatICSDateTime(entry.date, entry.start_time)}`);
      if (entry.end_time) {
        lines.push(`DTEND:${formatICSDateTime(entry.date, entry.end_time)}`);
      }
    } else {
      lines.push(`DTSTART;VALUE=DATE:${formatICSDate(entry.date)}`);
    }

    if (entry.service?.location) {
      lines.push(`LOCATION:${escapeICS(entry.service.location)}`);
    }

    // Build description
    const descParts: string[] = [];
    descParts.push(`Team: ${entry.team.name}`);
    if (entry.assignment?.role) {
      descParts.push(`Role: ${entry.assignment.role.name}`);
    }
    if (entry.assignment?.status) {
      descParts.push(`Status: ${entry.assignment.status}`);
    }
    lines.push(`DESCRIPTION:${escapeICS(descParts.join('\\n'))}`);

    // Categories
    const categories = [entry.team.name];
    if (entry.type === 'rehearsal') {
      categories.push('Rehearsal');
    } else {
      categories.push('Service');
    }
    lines.push(`CATEGORIES:${categories.map(escapeICS).join(',')}`);

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Record a calendar sync event
 *
 * Tracks when an assignment has been synced to an external calendar.
 *
 * @param assignmentId - The service assignment ID
 * @param provider - The calendar provider
 * @param externalEventId - The event ID in the external calendar
 * @returns The created sync record
 *
 * @example
 * await recordCalendarSync(assignmentId, 'google', 'google_event_abc123');
 */
export async function recordCalendarSync(
  assignmentId: string,
  provider: CalendarProvider,
  externalEventId: string
): Promise<CalendarSync> {
  const userId = await requireAuth();

  // Check if sync record already exists
  const { data: existing } = await supabase
    .from('calendar_sync')
    .select('id')
    .eq('service_assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('calendar_sync')
      .update({
        external_event_id: externalEventId,
        synced_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update sync record: ${error.message}`);
    }

    return data;
  }

  // Create new sync record
  const insertData: CalendarSyncInsert = {
    service_assignment_id: assignmentId,
    user_id: userId,
    provider,
    external_event_id: externalEventId,
  };

  const { data, error } = await supabase
    .from('calendar_sync')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record sync: ${error.message}`);
  }

  return data;
}

/**
 * Get all synced calendar events for current user
 *
 * @param provider - Optional filter by provider
 * @returns Array of sync records with details
 */
export async function getMySyncedEvents(
  provider?: CalendarProvider
): Promise<CalendarSyncWithDetails[]> {
  const userId = await requireAuth();

  let query = supabase
    .from('calendar_sync')
    .select(
      `
      *,
      service_assignment:service_assignments (
        id,
        service:services (
          id,
          name,
          service_date,
          start_time
        ),
        role:roles (
          id,
          name
        )
      )
    `
    )
    .eq('user_id', userId)
    .order('synced_at', { ascending: false });

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sync records: ${error.message}`);
  }

  return (data || []) as unknown as CalendarSyncWithDetails[];
}

/**
 * Delete a calendar sync record
 *
 * Call this when removing an event from external calendar.
 *
 * @param syncId - The sync record ID
 */
export async function deleteCalendarSync(syncId: string): Promise<void> {
  const userId = await requireAuth();

  const { error } = await supabase
    .from('calendar_sync')
    .delete()
    .eq('id', syncId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete sync record: ${error.message}`);
  }
}

/**
 * Record a sync error
 *
 * @param syncId - The sync record ID
 * @param errorMessage - The error message
 */
export async function recordSyncError(
  syncId: string,
  errorMessage: string
): Promise<void> {
  const userId = await requireAuth();

  const { error } = await supabase
    .from('calendar_sync')
    .update({
      last_sync_error: errorMessage,
    })
    .eq('id', syncId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to record sync error: ${error.message}`);
  }
}
