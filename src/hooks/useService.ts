/**
 * useService Hook
 *
 * Fetches a single service with all assignment details
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getServiceById,
  createAssignment as apiCreateAssignment,
  removeAssignment as apiRemoveAssignment,
  respondToAssignment as apiRespondToAssignment,
  AssignmentResponseData,
} from '../lib/api';
import {
  ServiceWithAssignments,
  ServiceAssignment,
} from '../types/database.types';

// ============================================================================
// Types
// ============================================================================

export interface UseServiceResult {
  /** The service with full details */
  service: ServiceWithAssignments | null;
  /** All assignments for this service */
  assignments: ServiceWithAssignments['assignments'];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Add an assignment */
  addAssignment: (teamMemberId: string, roleId: string) => Promise<ServiceAssignment | null>;
  /** Remove an assignment */
  removeAssignment: (assignmentId: string) => Promise<boolean>;
  /** Respond to an assignment (confirm/decline) */
  respondToAssignment: (
    assignmentId: string,
    response: AssignmentResponseData
  ) => Promise<ServiceAssignment | null>;
  /** Refresh service data */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching a single service with all assignment details
 *
 * @param serviceId - The service ID to fetch
 * @returns Service data, assignments, loading state, and management functions
 *
 * @example
 * const { service, assignments, isLoading } = useService(serviceId);
 *
 * if (isLoading) return <Loading />;
 *
 * return (
 *   <View>
 *     <Text>{service.name}</Text>
 *     <Text>{service.service_date} at {service.start_time}</Text>
 *     {assignments.map(a => (
 *       <AssignmentRow key={a.id} assignment={a} />
 *     ))}
 *   </View>
 * );
 */
export function useService(serviceId: string | null | undefined): UseServiceResult {
  const [service, setService] = useState<ServiceWithAssignments | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchService = useCallback(async () => {
    if (!serviceId) {
      setService(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getServiceById(serviceId);
      setService(data);
    } catch (err) {
      console.error('Failed to fetch service:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch service');
      setService(null);
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  // Fetch on mount and when serviceId changes
  useEffect(() => {
    fetchService();
  }, [fetchService]);

  const addAssignment = useCallback(
    async (teamMemberId: string, roleId: string): Promise<ServiceAssignment | null> => {
      if (!serviceId) {
        setError('No service selected');
        return null;
      }

      try {
        const assignment = await apiCreateAssignment(serviceId, teamMemberId, roleId);
        // Refresh to get updated assignments
        await fetchService();
        return assignment;
      } catch (err) {
        console.error('Failed to add assignment:', err);
        setError(err instanceof Error ? err.message : 'Failed to add assignment');
        return null;
      }
    },
    [serviceId, fetchService]
  );

  const removeAssignment = useCallback(
    async (assignmentId: string): Promise<boolean> => {
      try {
        await apiRemoveAssignment(assignmentId);
        // Update local state immediately
        setService((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            assignments: prev.assignments.filter((a) => a.id !== assignmentId),
          };
        });
        return true;
      } catch (err) {
        console.error('Failed to remove assignment:', err);
        setError(err instanceof Error ? err.message : 'Failed to remove assignment');
        return false;
      }
    },
    []
  );

  const respondToAssignment = useCallback(
    async (
      assignmentId: string,
      response: AssignmentResponseData
    ): Promise<ServiceAssignment | null> => {
      try {
        const updated = await apiRespondToAssignment(assignmentId, response);
        // Update local state
        setService((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            assignments: prev.assignments.map((a) =>
              a.id === assignmentId ? { ...a, ...updated } : a
            ),
          };
        });
        return updated;
      } catch (err) {
        console.error('Failed to respond to assignment:', err);
        setError(err instanceof Error ? err.message : 'Failed to respond to assignment');
        return null;
      }
    },
    []
  );

  const refetch = useCallback(async () => {
    await fetchService();
  }, [fetchService]);

  return {
    service,
    assignments: service?.assignments || [],
    isLoading,
    error,
    addAssignment,
    removeAssignment,
    respondToAssignment,
    refetch,
  };
}
