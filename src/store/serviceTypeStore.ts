/**
 * Service Type Store
 *
 * Manages custom service types per team
 * Examples: 주일예배 2부, 주일예배 4부, 금요예배, etc.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScheduleType = 'recurring' | 'manual';
export type RehearsalType = 'same_day' | 'different_day' | 'days_before' | 'none';

export interface ServiceType {
  id: string;
  name: string;

  // Schedule type: recurring (weekly) or manual (pick dates)
  scheduleType: ScheduleType;

  /** Default day of week (0=Sun, 1=Mon, ..., 6=Sat) - for recurring services */
  defaultDay?: number;
  /** Service time (HH:MM format) */
  serviceTime?: string;

  // Rehearsal settings
  /** How rehearsal is scheduled */
  rehearsalType: RehearsalType;
  /** Rehearsal day (0-6) - if rehearsalType is 'different_day' */
  rehearsalDay?: number;
  /** Rehearsal time (HH:MM format) */
  rehearsalTime?: string;
  /** Days before service for rehearsal - if rehearsalType is 'days_before' */
  rehearsalDaysBefore?: number;

  /** Order for display */
  order: number;
  /** Is this the default/primary service? */
  isPrimary?: boolean;
}

interface ServiceTypeState {
  /** Service types keyed by team ID */
  serviceTypesByTeam: Record<string, ServiceType[]>;
}

interface AddServiceTypeParams {
  name: string;
  scheduleType: ScheduleType;
  defaultDay?: number;
  serviceTime?: string;
  rehearsalType: RehearsalType;
  rehearsalDay?: number;
  rehearsalTime?: string;
  rehearsalDaysBefore?: number;
  isPrimary?: boolean;
}

interface ServiceTypeActions {
  /** Get service types for a team */
  getServiceTypes: (teamId: string) => ServiceType[];
  /** Add a new service type (legacy signature for backwards compatibility) */
  addServiceType: (teamId: string, name: string, defaultDay?: number, serviceTime?: string, rehearsalTime?: string) => void;
  /** Add a new service type with full params */
  addServiceTypeFull: (teamId: string, params: AddServiceTypeParams) => void;
  /** Update a service type */
  updateServiceType: (teamId: string, typeId: string, updates: Partial<Omit<ServiceType, 'id'>>) => void;
  /** Delete a service type */
  deleteServiceType: (teamId: string, typeId: string) => void;
  /** Reorder service types */
  reorderServiceTypes: (teamId: string, types: ServiceType[]) => void;
  /** Initialize default service types for a team */
  initializeDefaults: (teamId: string) => void;
  /** Clear service types for a team (for re-onboarding) */
  clearTeamServiceTypes: (teamId: string) => void;
  /** Reset all */
  reset: () => void;
}

// Default service types for new teams
const DEFAULT_SERVICE_TYPES: Omit<ServiceType, 'id'>[] = [
  {
    name: '주일예배 1부',
    scheduleType: 'recurring',
    defaultDay: 0,
    serviceTime: '09:00',
    rehearsalType: 'same_day',
    rehearsalTime: '08:00',
    order: 0,
    isPrimary: true,
  },
  {
    name: '주일예배 2부',
    scheduleType: 'recurring',
    defaultDay: 0,
    serviceTime: '11:00',
    rehearsalType: 'same_day',
    rehearsalTime: '10:00',
    order: 1,
  },
  {
    name: '주일예배 3부',
    scheduleType: 'recurring',
    defaultDay: 0,
    serviceTime: '14:00',
    rehearsalType: 'same_day',
    rehearsalTime: '13:00',
    order: 2,
  },
];

// Generate unique ID with timestamp + random suffix to avoid duplicates
const generateUniqueId = () => `st_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useServiceTypeStore = create<ServiceTypeState & ServiceTypeActions>()(
  persist(
    (set, get) => ({
      serviceTypesByTeam: {},

      getServiceTypes: (teamId) => {
        const types = get().serviceTypesByTeam[teamId];
        if (!types || types.length === 0) {
          return [];
        }
        // Deduplicate by ID (fix for legacy data with duplicate keys)
        const seen = new Set<string>();
        const uniqueTypes = types.filter(t => {
          if (seen.has(t.id)) {
            return false;
          }
          seen.add(t.id);
          return true;
        });
        return uniqueTypes.sort((a, b) => a.order - b.order);
      },

      // Legacy method - defaults to recurring with same_day rehearsal
      addServiceType: (teamId, name, defaultDay, serviceTime, rehearsalTime) => {
        set((state) => {
          const existing = state.serviceTypesByTeam[teamId] || [];
          // Check if name already exists
          if (existing.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            console.warn(`Service type "${name}" already exists`);
            return state; // Don't add duplicate
          }
          const maxOrder = existing.length > 0 ? Math.max(...existing.map(t => t.order)) : -1;
          const newType: ServiceType = {
            id: generateUniqueId(),
            name,
            scheduleType: 'recurring',
            defaultDay,
            serviceTime,
            rehearsalType: rehearsalTime ? 'same_day' : 'none',
            rehearsalTime,
            order: maxOrder + 1,
          };
          return {
            serviceTypesByTeam: {
              ...state.serviceTypesByTeam,
              [teamId]: [...existing, newType],
            },
          };
        });
      },

      // Full method with all new fields
      addServiceTypeFull: (teamId, params) => {
        set((state) => {
          const existing = state.serviceTypesByTeam[teamId] || [];
          // Check if name already exists
          if (existing.some(t => t.name.toLowerCase() === params.name.toLowerCase())) {
            console.warn(`Service type "${params.name}" already exists`);
            return state; // Don't add duplicate
          }
          const maxOrder = existing.length > 0 ? Math.max(...existing.map(t => t.order)) : -1;
          const newType: ServiceType = {
            id: generateUniqueId(),
            ...params,
            order: maxOrder + 1,
          };
          return {
            serviceTypesByTeam: {
              ...state.serviceTypesByTeam,
              [teamId]: [...existing, newType],
            },
          };
        });
      },

      updateServiceType: (teamId, typeId, updates) => {
        set((state) => {
          const types = state.serviceTypesByTeam[teamId] || [];
          return {
            serviceTypesByTeam: {
              ...state.serviceTypesByTeam,
              [teamId]: types.map(t => t.id === typeId ? { ...t, ...updates } : t),
            },
          };
        });
      },

      deleteServiceType: (teamId, typeId) => {
        set((state) => {
          const types = state.serviceTypesByTeam[teamId] || [];
          return {
            serviceTypesByTeam: {
              ...state.serviceTypesByTeam,
              [teamId]: types.filter(t => t.id !== typeId),
            },
          };
        });
      },

      reorderServiceTypes: (teamId, types) => {
        set((state) => ({
          serviceTypesByTeam: {
            ...state.serviceTypesByTeam,
            [teamId]: types.map((t, i) => ({ ...t, order: i })),
          },
        }));
      },

      initializeDefaults: (teamId) => {
        set((state) => {
          // Only initialize if team doesn't have any types
          if (state.serviceTypesByTeam[teamId]?.length > 0) {
            return state;
          }
          const defaultTypes: ServiceType[] = DEFAULT_SERVICE_TYPES.map((t, i) => ({
            ...t,
            id: `st_default_${i}`,
          }));
          return {
            serviceTypesByTeam: {
              ...state.serviceTypesByTeam,
              [teamId]: defaultTypes,
            },
          };
        });
      },

      clearTeamServiceTypes: (teamId) => {
        set((state) => ({
          serviceTypesByTeam: {
            ...state.serviceTypesByTeam,
            [teamId]: [],
          },
        }));
      },

      reset: () => {
        set({ serviceTypesByTeam: {} });
      },
    }),
    {
      name: 'service-type-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
