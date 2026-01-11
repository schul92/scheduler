/**
 * Conflict Store
 *
 * Manages schedule conflicts when members respond late
 * with unavailability after already being assigned
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ScheduleConflict {
  id: string;
  memberId: string;
  memberName: string;
  serviceDate: string;
  serviceName: string;
  instrumentId: string;
  instrumentName: string;
  conflictType: 'late_unavailable' | 'late_available';
  createdAt: string;
  isResolved: boolean;
  resolvedAt?: string;
}

interface ConflictStore {
  conflicts: ScheduleConflict[];

  // Actions
  addConflict: (conflict: Omit<ScheduleConflict, 'id' | 'createdAt' | 'isResolved'>) => void;
  resolveConflict: (conflictId: string) => void;
  clearAllConflicts: () => void;
  getUnresolvedConflicts: () => ScheduleConflict[];
  getConflictsByDate: (date: string) => ScheduleConflict[];
}

export const useConflictStore = create<ConflictStore>()(
  persist(
    (set, get) => ({
      // Real conflicts will be added when members respond late with unavailability
      conflicts: [],

  addConflict: (conflict) => {
    const newConflict: ScheduleConflict = {
      ...conflict,
      id: `c${Date.now()}`,
      createdAt: new Date().toISOString(),
      isResolved: false,
    };

    set((state) => ({
      conflicts: [newConflict, ...state.conflicts],
    }));
  },

  resolveConflict: (conflictId) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, isResolved: true, resolvedAt: new Date().toISOString() }
          : c
      ),
    }));
  },

  clearAllConflicts: () => {
    set({ conflicts: [] });
  },

  getUnresolvedConflicts: () => {
    return get().conflicts.filter((c) => !c.isResolved);
  },

  getConflictsByDate: (date) => {
    return get().conflicts.filter((c) => c.serviceDate === date);
  },
    }),
    {
      name: 'conflict-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        conflicts: state.conflicts,
      }),
    }
  )
);

/**
 * Helper function to check if there's a conflict when a member responds late
 * This would be called from the availability submission flow
 */
export function checkForConflict(
  memberId: string,
  memberName: string,
  date: string,
  newAvailability: 'available' | 'unavailable',
  currentAssignments: Array<{
    serviceDate: string;
    serviceName: string;
    instrumentId: string;
    instrumentName: string;
    assignedMemberId: string;
  }>
): ScheduleConflict | null {
  // Check if member is assigned to any service on this date
  const assignment = currentAssignments.find(
    (a) => a.serviceDate === date && a.assignedMemberId === memberId
  );

  if (!assignment) {
    return null; // No conflict - member wasn't assigned
  }

  if (newAvailability === 'available') {
    return null; // No conflict - member confirmed availability
  }

  // CONFLICT: Member was assigned but says they're unavailable
  return {
    id: `c${Date.now()}`,
    memberId,
    memberName,
    serviceDate: date,
    serviceName: assignment.serviceName,
    instrumentId: assignment.instrumentId,
    instrumentName: assignment.instrumentName,
    conflictType: 'late_unavailable',
    createdAt: new Date().toISOString(),
    isResolved: false,
  };
}
