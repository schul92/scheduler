/**
 * Availability Store
 *
 * Manages member availability responses for requested worship dates.
 * Members respond PER SERVICE TYPE for each date (not just per date).
 *
 * Flow:
 * 1. Leader sets dates (schedulingStore.selectedDates) and confirms (isConfirmed=true)
 * 2. Members receive notification to submit availability
 * 3. Members mark each service (date + service type) as available/unavailable (this store)
 * 4. Leader views responses and assigns team
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceType } from './serviceTypeStore';

export type AvailabilityStatus = 'available' | 'unavailable' | 'pending';

export interface AvailabilityRequest {
  /** Date (ISO string YYYY-MM-DD) */
  date: string;
  /** Service type ID */
  serviceTypeId: string;
  /** Service type name (for display) */
  serviceTypeName: string;
  /** Service time (for display) */
  serviceTime?: string;
  /** Team ID this request is for */
  teamId: string;
  /** Deadline to respond */
  deadline: string | null;
  /** When the request was sent */
  requestedAt: string;
}

export interface MemberAvailability {
  /** Date (ISO string) */
  date: string;
  /** Service type ID */
  serviceTypeId: string;
  /** Member's availability status */
  status: AvailabilityStatus;
  /** When they responded */
  respondedAt?: string;
  /** Optional note from member */
  note?: string;
}

/** Creates a unique key for a date+serviceType combination */
const makeKey = (date: string, serviceTypeId: string) => `${date}-${serviceTypeId}`;

/** Parse YYYY-MM-DD string as local date (avoids UTC parsing issues) */
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Parses a key back to date and serviceTypeId */
const parseKey = (key: string) => {
  const lastDash = key.lastIndexOf('-');
  return {
    date: key.substring(0, lastDash),
    serviceTypeId: key.substring(lastDash + 1),
  };
};

interface AvailabilityState {
  /** Pending availability requests for current user (dates leader requested) */
  pendingRequests: AvailabilityRequest[];
  /** Current user's availability responses by date-serviceTypeId key */
  myAvailability: Record<string, MemberAvailability>;
}

interface AvailabilityActions {
  /** Add availability requests (when leader confirms dates) */
  addRequests: (requests: AvailabilityRequest[]) => void;
  /** Sync dates from leader with service types - adds new, removes deleted, keeps existing responses */
  syncDatesFromLeader: (
    dates: string[],
    serviceTypes: ServiceType[],
    teamId: string,
    deadline?: string | null
  ) => {
    added: string[];
    removed: string[];
    kept: string[];
  };
  /** Clear a request after responding */
  clearRequest: (date: string, serviceTypeId: string) => void;
  /** Remove dates that are no longer needed */
  removeDates: (dates: string[]) => void;
  /** Submit availability for a date + service type */
  submitAvailability: (date: string, serviceTypeId: string, status: AvailabilityStatus, note?: string) => void;
  /** Get availability for a date + service type */
  getAvailability: (date: string, serviceTypeId: string) => MemberAvailability | null;
  /** Check if there are pending requests */
  hasPendingRequests: () => boolean;
  /** Get count of pending requests */
  getPendingCount: () => number;
  /** Get pending requests grouped by date */
  getPendingByDate: () => Record<string, AvailabilityRequest[]>;
  /** Reset all state */
  reset: () => void;
  /** Clear availability for specific dates (to start fresh when new requests come in) */
  clearAvailabilityForDates: (dates: string[]) => void;
}

export const useAvailabilityStore = create<AvailabilityState & AvailabilityActions>()(
  persist(
    (set, get) => ({
      // Initial state - empty until leader confirms dates
      pendingRequests: [],
      myAvailability: {},

  addRequests: (requests) => {
    set((state) => ({
      pendingRequests: [
        ...state.pendingRequests.filter(
          (r) => !requests.some(
            (newR) => newR.date === r.date &&
                     newR.serviceTypeId === r.serviceTypeId &&
                     newR.teamId === r.teamId
          )
        ),
        ...requests,
      ],
    }));
  },

  syncDatesFromLeader: (dates, serviceTypes, teamId, deadline = null) => {
    const now = new Date().toISOString();

    // Build new request keys (date-serviceTypeId) based on service type default days
    // These calculations don't depend on current state, so can be done outside set()
    const newRequestKeys = new Set<string>();
    dates.forEach(dateStr => {
      const dayOfWeek = parseLocalDate(dateStr).getDay();

      // Find service types that match this day (strict equality - undefined means no default day)
      const matchingServiceTypes = serviceTypes.filter(st =>
        st.defaultDay === dayOfWeek
      );

      // Only create pending requests for matching service types
      // Days without configured service types will be handled as ad-hoc services
      matchingServiceTypes.forEach(st => {
        newRequestKeys.add(makeKey(dateStr, st.id));
      });
    });

    // Track what was added/removed/kept for return value
    let added: string[] = [];
    let removed: string[] = [];
    let kept: string[] = [];

    // All state-dependent calculations MUST be inside set() for atomicity
    set((state) => {
      // Get all existing keys (pending or responded) from CURRENT state
      const existingPendingKeys = new Set(
        state.pendingRequests
          .filter(r => r.teamId === teamId)
          .map(r => makeKey(r.date, r.serviceTypeId))
      );
      const respondedKeys = new Set(Object.keys(state.myAvailability));
      const allExistingKeys = new Set([...existingPendingKeys, ...respondedKeys]);

      // Calculate what's new, removed, and kept
      added = [];
      removed = [];
      kept = [];

      // Find NEW keys (not in existing pending or responded)
      newRequestKeys.forEach(key => {
        if (!allExistingKeys.has(key)) {
          added.push(key);
        } else {
          kept.push(key);
        }
      });

      // Find REMOVED keys (in existing but not in new list)
      allExistingKeys.forEach(key => {
        if (!newRequestKeys.has(key)) {
          removed.push(key);
        }
      });

      // Create new pending requests for ADDED keys only
      const newPendingRequests: AvailabilityRequest[] = [];
      added.forEach(key => {
        const { date, serviceTypeId } = parseKey(key);
        const st = serviceTypes.find(s => s.id === serviceTypeId);
        if (st) {
          newPendingRequests.push({
            date,
            serviceTypeId: st.id,
            serviceTypeName: st.name,
            serviceTime: st.serviceTime,
            teamId,
            deadline,
            requestedAt: now,
          });
        }
      });

      // Remove old pending requests for this team, keep others
      const otherTeamRequests = state.pendingRequests.filter(r => r.teamId !== teamId);

      // Keep pending requests for kept keys (not yet responded)
      const keptPendingRequests = state.pendingRequests.filter(r => {
        if (r.teamId !== teamId) return false;
        const key = makeKey(r.date, r.serviceTypeId);
        return newRequestKeys.has(key);
      });

      // Remove myAvailability for removed keys
      const newMyAvailability = { ...state.myAvailability };
      removed.forEach(key => {
        delete newMyAvailability[key];
      });

      return {
        pendingRequests: [...otherTeamRequests, ...keptPendingRequests, ...newPendingRequests],
        myAvailability: newMyAvailability,
      };
    });

    return { added, removed, kept };
  },

  clearRequest: (date, serviceTypeId) => {
    set((state) => ({
      pendingRequests: state.pendingRequests.filter(
        (r) => !(r.date === date && r.serviceTypeId === serviceTypeId)
      ),
    }));
  },

  removeDates: (dates) => {
    const datesToRemove = new Set(dates);
    set((state) => ({
      pendingRequests: state.pendingRequests.filter(r => !datesToRemove.has(r.date)),
      myAvailability: Object.fromEntries(
        Object.entries(state.myAvailability).filter(([key]) => {
          const { date } = parseKey(key);
          return !datesToRemove.has(date);
        })
      ),
    }));
  },

  submitAvailability: (date, serviceTypeId, status, note) => {
    const now = new Date().toISOString();
    const key = makeKey(date, serviceTypeId);
    set((state) => ({
      myAvailability: {
        ...state.myAvailability,
        [key]: {
          date,
          serviceTypeId,
          status,
          respondedAt: now,
          note,
        },
      },
      // Remove from pending after responding
      pendingRequests: state.pendingRequests.filter(
        (r) => !(r.date === date && r.serviceTypeId === serviceTypeId)
      ),
    }));
  },

  getAvailability: (date, serviceTypeId) => {
    const key = makeKey(date, serviceTypeId);
    return get().myAvailability[key] || null;
  },

  hasPendingRequests: () => {
    return get().pendingRequests.length > 0;
  },

  getPendingCount: () => {
    return get().pendingRequests.length;
  },

  getPendingByDate: () => {
    const result: Record<string, AvailabilityRequest[]> = {};
    get().pendingRequests.forEach(req => {
      if (!result[req.date]) {
        result[req.date] = [];
      }
      result[req.date].push(req);
    });
    // Sort requests within each date by service time
    Object.keys(result).forEach(date => {
      result[date].sort((a, b) => (a.serviceTime || '').localeCompare(b.serviceTime || ''));
    });
    return result;
  },

  reset: () => {
    set({
      pendingRequests: [],
      myAvailability: {},
    });
  },

  clearAvailabilityForDates: (dates: string[]) => {
    const datesToClear = new Set(dates);
    set((state) => {
      const newMyAvailability = { ...state.myAvailability };
      // Remove entries for the specified dates
      Object.keys(newMyAvailability).forEach(key => {
        const [date] = key.split('-');
        if (datesToClear.has(date)) {
          delete newMyAvailability[key];
        }
      });
      return { myAvailability: newMyAvailability };
    });
  },
    }),
    {
      name: 'availability-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pendingRequests: state.pendingRequests,
        myAvailability: state.myAvailability,
      }),
    }
  )
);
