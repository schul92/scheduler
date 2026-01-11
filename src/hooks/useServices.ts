/**
 * useServices Hook
 *
 * Fetches and manages services for a team
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getTeamServices,
  createService as apiCreateService,
  deleteService as apiDeleteService,
  updateService as apiUpdateService,
  publishService as apiPublishService,
  ServiceWithStats,
  ServiceFilters,
  CreateServiceData,
  UpdateServiceData,
} from '../lib/api';
import { Service } from '../types/database.types';

// ============================================================================
// Types
// ============================================================================

export interface UseServicesResult {
  /** List of services with statistics */
  services: ServiceWithStats[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Create a new service */
  createService: (data: Omit<CreateServiceData, 'team_id'>) => Promise<Service | null>;
  /** Update a service */
  updateService: (serviceId: string, data: UpdateServiceData) => Promise<Service | null>;
  /** Delete a service */
  deleteService: (serviceId: string) => Promise<boolean>;
  /** Publish a service */
  publishService: (serviceId: string) => Promise<Service | null>;
  /** Refresh services list */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching and managing services for a team
 *
 * @param teamId - The team ID to fetch services for
 * @param filters - Optional filters for date range and status
 * @returns Services list, loading state, and CRUD functions
 *
 * @example
 * const { services, isLoading, createService, deleteService } = useServices(teamId, {
 *   startDate: '2024-03-01',
 *   status: ['published', 'draft']
 * });
 *
 * // Create new service
 * await createService({
 *   name: 'Sunday Worship',
 *   service_date: '2024-03-10',
 *   start_time: '10:00'
 * });
 */
export function useServices(
  teamId: string | null | undefined,
  filters?: ServiceFilters
): UseServicesResult {
  const [services, setServices] = useState<ServiceWithStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    if (!teamId) {
      setServices([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getTeamServices(teamId, filters);
      setServices(data);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, filters?.startDate, filters?.endDate, filters?.status, filters?.includePast]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const createService = useCallback(
    async (data: Omit<CreateServiceData, 'team_id'>): Promise<Service | null> => {
      if (!teamId) {
        setError('No team selected');
        return null;
      }

      try {
        const service = await apiCreateService({ ...data, team_id: teamId });
        // Refresh list after creating
        await fetchServices();
        return service;
      } catch (err) {
        console.error('Failed to create service:', err);
        setError(err instanceof Error ? err.message : 'Failed to create service');
        return null;
      }
    },
    [teamId, fetchServices]
  );

  const updateService = useCallback(
    async (serviceId: string, data: UpdateServiceData): Promise<Service | null> => {
      try {
        const service = await apiUpdateService(serviceId, data);
        // Refresh list after updating
        await fetchServices();
        return service;
      } catch (err) {
        console.error('Failed to update service:', err);
        setError(err instanceof Error ? err.message : 'Failed to update service');
        return null;
      }
    },
    [fetchServices]
  );

  const deleteService = useCallback(
    async (serviceId: string): Promise<boolean> => {
      try {
        await apiDeleteService(serviceId);
        // Remove from local state immediately
        setServices((prev) => prev.filter((s) => s.id !== serviceId));
        return true;
      } catch (err) {
        console.error('Failed to delete service:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete service');
        return false;
      }
    },
    []
  );

  const publishService = useCallback(
    async (serviceId: string): Promise<Service | null> => {
      try {
        const service = await apiPublishService(serviceId);
        // Refresh list after publishing
        await fetchServices();
        return service;
      } catch (err) {
        console.error('Failed to publish service:', err);
        setError(err instanceof Error ? err.message : 'Failed to publish service');
        return null;
      }
    },
    [fetchServices]
  );

  const refetch = useCallback(async () => {
    await fetchServices();
  }, [fetchServices]);

  return {
    services,
    isLoading,
    error,
    createService,
    updateService,
    deleteService,
    publishService,
    refetch,
  };
}

/**
 * Hook for fetching services for the active team
 */
export function useActiveTeamServices(filters?: ServiceFilters): UseServicesResult {
  // Import here to avoid circular dependency
  const { useTeamStore } = require('../store/teamStore');
  const activeTeamId = useTeamStore((state: any) => state.activeTeamId);
  return useServices(activeTeamId, filters);
}
