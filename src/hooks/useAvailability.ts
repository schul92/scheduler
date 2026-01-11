/**
 * useAvailability Hook
 *
 * Manages user availability for a team
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAvailability,
  setAvailability as apiSetAvailability,
  bulkSetAvailability as apiBulkSetAvailability,
  deleteAvailability as apiDeleteAvailability,
  getTeamAvailability as apiGetTeamAvailability,
  AvailabilityRecord,
  SetAvailabilityData,
  TeamAvailabilitySummary,
} from '../lib/api';
import { Availability } from '../types/database.types';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface UseAvailabilityResult {
  /** Availability records for the date range */
  availability: AvailabilityRecord[];
  /** Map of date -> availability for quick lookup */
  availabilityMap: Map<string, AvailabilityRecord>;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Set availability for a single date */
  setAvailability: (date: string, isAvailable: boolean, reason?: string) => Promise<Availability | null>;
  /** Set availability for multiple dates */
  bulkSetAvailability: (dates: SetAvailabilityData[]) => Promise<Availability[]>;
  /** Clear availability for a date (reset to unknown) */
  clearAvailability: (date: string) => Promise<boolean>;
  /** Check if user is available on a specific date */
  isAvailable: (date: string) => boolean | null;
  /** Refresh availability data */
  refetch: () => Promise<void>;
}

export interface UseTeamAvailabilityResult {
  /** Team availability summary for the date */
  summary: TeamAvailabilitySummary | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for managing user's own availability in a team
 *
 * @param teamId - The team ID
 * @param dateRange - Date range to fetch availability for
 * @returns Availability data and management functions
 *
 * @example
 * const { availability, setAvailability, isAvailable } = useAvailability(teamId, {
 *   startDate: '2024-03-01',
 *   endDate: '2024-03-31'
 * });
 *
 * // Set unavailable for a date
 * await setAvailability('2024-03-15', false, 'Out of town');
 *
 * // Check availability
 * const available = isAvailable('2024-03-15'); // false
 */
export function useAvailability(
  teamId: string | null | undefined,
  dateRange: DateRange
): UseAvailabilityResult {
  const [availability, setAvailabilityState] = useState<AvailabilityRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!teamId) {
      setAvailabilityState([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getAvailability(teamId, dateRange.startDate, dateRange.endDate);
      setAvailabilityState(data);
    } catch (err) {
      console.error('Failed to fetch availability:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch availability');
      setAvailabilityState([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, dateRange.startDate, dateRange.endDate]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Create a map for quick lookup
  const availabilityMap = useMemo(() => {
    return new Map(availability.map((a) => [a.date, a]));
  }, [availability]);

  const setAvailability = useCallback(
    async (date: string, isAvailable: boolean, reason?: string): Promise<Availability | null> => {
      if (!teamId) {
        setError('No team selected');
        return null;
      }

      try {
        const result = await apiSetAvailability(teamId, date, isAvailable, reason);
        // Update local state
        setAvailabilityState((prev) => {
          const existing = prev.findIndex((a) => a.date === date);
          const newRecord: AvailabilityRecord = {
            id: result.id,
            date: result.date,
            is_available: result.is_available,
            reason: result.reason,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newRecord;
            return updated;
          }
          return [...prev, newRecord].sort((a, b) => a.date.localeCompare(b.date));
        });
        return result;
      } catch (err) {
        console.error('Failed to set availability:', err);
        setError(err instanceof Error ? err.message : 'Failed to set availability');
        return null;
      }
    },
    [teamId]
  );

  const bulkSetAvailability = useCallback(
    async (dates: SetAvailabilityData[]): Promise<Availability[]> => {
      if (!teamId) {
        setError('No team selected');
        return [];
      }

      try {
        const results = await apiBulkSetAvailability(teamId, dates);
        // Refresh to get updated data
        await fetchAvailability();
        return results;
      } catch (err) {
        console.error('Failed to set availability:', err);
        setError(err instanceof Error ? err.message : 'Failed to set availability');
        return [];
      }
    },
    [teamId, fetchAvailability]
  );

  const clearAvailability = useCallback(
    async (date: string): Promise<boolean> => {
      if (!teamId) {
        setError('No team selected');
        return false;
      }

      try {
        await apiDeleteAvailability(teamId, date);
        // Update local state
        setAvailabilityState((prev) => prev.filter((a) => a.date !== date));
        return true;
      } catch (err) {
        console.error('Failed to clear availability:', err);
        setError(err instanceof Error ? err.message : 'Failed to clear availability');
        return false;
      }
    },
    [teamId]
  );

  const isAvailable = useCallback(
    (date: string): boolean | null => {
      const record = availabilityMap.get(date);
      return record ? record.is_available : null; // null means unknown
    },
    [availabilityMap]
  );

  const refetch = useCallback(async () => {
    await fetchAvailability();
  }, [fetchAvailability]);

  return {
    availability,
    availabilityMap,
    isLoading,
    error,
    setAvailability,
    bulkSetAvailability,
    clearAvailability,
    isAvailable,
    refetch,
  };
}

/**
 * Hook for viewing team-wide availability (admin only)
 *
 * @param teamId - The team ID
 * @param date - The specific date to check
 * @returns Team availability summary
 *
 * @example
 * const { summary, isLoading } = useTeamAvailability(teamId, '2024-03-15');
 *
 * if (summary) {
 *   console.log(`${summary.available_count}/${summary.total_members} available`);
 * }
 */
export function useTeamAvailability(
  teamId: string | null | undefined,
  date: string | null | undefined
): UseTeamAvailabilityResult {
  const [summary, setSummary] = useState<TeamAvailabilitySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamAvailability = useCallback(async () => {
    if (!teamId || !date) {
      setSummary(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiGetTeamAvailability(teamId, date);
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch team availability:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch team availability');
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, date]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchTeamAvailability();
  }, [fetchTeamAvailability]);

  const refetch = useCallback(async () => {
    await fetchTeamAvailability();
  }, [fetchTeamAvailability]);

  return {
    summary,
    isLoading,
    error,
    refetch,
  };
}
