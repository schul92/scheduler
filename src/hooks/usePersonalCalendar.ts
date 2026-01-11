/**
 * usePersonalCalendar Hook
 *
 * Fetches personal calendar entries across all teams
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPersonalCalendar,
  getUpcomingServices,
  getTeamServices,
  generateICS,
  UpcomingService,
  ServiceWithStats,
} from '../lib/api';
import { PersonalCalendarEntry, Team } from '../types/database.types';

// ============================================================================
// Types
// ============================================================================

export interface UsePersonalCalendarResult {
  /** All calendar entries for the month */
  entries: PersonalCalendarEntry[];
  /** Entries grouped by date */
  entriesByDate: Map<string, PersonalCalendarEntry[]>;
  /** All teams that have entries */
  teams: Pick<Team, 'id' | 'name' | 'color'>[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Generate ICS file content */
  exportToICS: (calendarName?: string) => string;
  /** Refresh calendar data */
  refetch: () => Promise<void>;
}

export interface UseUpcomingServicesResult {
  /** Upcoming services */
  services: UpcomingService[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data */
  refetch: () => Promise<void>;
}

export interface UseTeamServicesResult {
  /** Team services */
  services: ServiceWithStats[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data */
  refetch: () => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get date range for a month
 */
function getMonthDateRange(month: Date): { startDate: string; endDate: string } {
  const year = month.getFullYear();
  const monthNum = month.getMonth();

  // First day of month
  const startDate = new Date(year, monthNum, 1).toISOString().split('T')[0];

  // Last day of month
  const endDate = new Date(year, monthNum + 1, 0).toISOString().split('T')[0];

  return { startDate, endDate };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching personal calendar entries for a month
 *
 * @param month - The month to fetch (Date object, will use year and month)
 * @returns Calendar entries, grouped entries, teams, and export function
 *
 * @example
 * const { entries, entriesByDate, teams, exportToICS } = usePersonalCalendar(new Date());
 *
 * // Get entries for a specific date
 * const todayEntries = entriesByDate.get('2024-03-15') || [];
 *
 * // Export to ICS
 * const icsContent = exportToICS('My Schedule');
 */
export function usePersonalCalendar(month: Date): UsePersonalCalendarResult {
  const [entries, setEntries] = useState<PersonalCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(() => getMonthDateRange(month), [month.getFullYear(), month.getMonth()]);

  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getPersonalCalendar(dateRange.startDate, dateRange.endDate);
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  // Fetch on mount and when month changes
  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, PersonalCalendarEntry[]>();
    for (const entry of entries) {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    }
    return map;
  }, [entries]);

  // Extract unique teams
  const teams = useMemo(() => {
    const teamMap = new Map<string, Pick<Team, 'id' | 'name' | 'color'>>();
    for (const entry of entries) {
      if (!teamMap.has(entry.team.id)) {
        teamMap.set(entry.team.id, entry.team);
      }
    }
    return Array.from(teamMap.values());
  }, [entries]);

  const exportToICS = useCallback(
    (calendarName?: string): string => {
      return generateICS(entries, calendarName);
    },
    [entries]
  );

  const refetch = useCallback(async () => {
    await fetchCalendar();
  }, [fetchCalendar]);

  return {
    entries,
    entriesByDate,
    teams,
    isLoading,
    error,
    exportToICS,
    refetch,
  };
}

/**
 * Hook for fetching personal calendar for a custom date range
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Same as usePersonalCalendar
 */
export function usePersonalCalendarRange(
  startDate: string,
  endDate: string
): UsePersonalCalendarResult {
  const [entries, setEntries] = useState<PersonalCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getPersonalCalendar(startDate, endDate);
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, PersonalCalendarEntry[]>();
    for (const entry of entries) {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    }
    return map;
  }, [entries]);

  const teams = useMemo(() => {
    const teamMap = new Map<string, Pick<Team, 'id' | 'name' | 'color'>>();
    for (const entry of entries) {
      if (!teamMap.has(entry.team.id)) {
        teamMap.set(entry.team.id, entry.team);
      }
    }
    return Array.from(teamMap.values());
  }, [entries]);

  const exportToICS = useCallback(
    (calendarName?: string): string => {
      return generateICS(entries, calendarName);
    },
    [entries]
  );

  const refetch = useCallback(async () => {
    await fetchCalendar();
  }, [fetchCalendar]);

  return {
    entries,
    entriesByDate,
    teams,
    isLoading,
    error,
    exportToICS,
    refetch,
  };
}

// Helper to format date as YYYY-MM-DD in local timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


/**
 * Hook for fetching upcoming services for dashboard
 *
 * @param limit - Maximum number of services to return (default: 5)
 * @returns Upcoming services list
 *
 * @example
 * const { services, isLoading } = useUpcomingServices(10);
 *
 * return (
 *   <View>
 *     {services.map(s => (
 *       <ServiceCard key={s.id} service={s} />
 *     ))}
 *   </View>
 * );
 */
export function useUpcomingServices(limit: number = 5): UseUpcomingServicesResult {
  const [services, setServices] = useState<UpcomingService[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getUpcomingServices(limit);
      setServices(data);
    } catch (err) {
      console.error('Failed to fetch upcoming services:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch upcoming services');
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const refetch = useCallback(async () => {
    await fetchServices();
  }, [fetchServices]);

  return {
    services,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching all team services (not just user's assignments)
 *
 * @param teamId - Team ID to fetch services for
 * @param limit - Maximum number of services to return (default: 5)
 * @returns Team services list
 *
 * @example
 * const { services, isLoading } = useTeamServices('team-123', 5);
 */
export function useTeamServices(teamId: string | null, limit: number = 5): UseTeamServicesResult {
  const [services, setServices] = useState<ServiceWithStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    if (!teamId) {
      setServices([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get today's date for filtering
      const today = formatLocalDate(new Date());

      // Only fetch published/completed services for Team Schedule
      // Draft services are just availability requests, not confirmed schedules
      const data = await getTeamServices(teamId, {
        startDate: today,
        includePast: false,
        status: ['published', 'completed'],
      });

      // Sort by date and limit
      const sorted = data
        .sort((a, b) => a.service_date.localeCompare(b.service_date))
        .slice(0, limit);

      setServices(sorted);
    } catch (err) {
      console.error('Failed to fetch team services:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch team services');
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, limit]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const refetch = useCallback(async () => {
    await fetchServices();
  }, [fetchServices]);

  return {
    services,
    isLoading,
    error,
    refetch,
  };
}
