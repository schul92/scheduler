/**
 * Scheduling Store
 *
 * Manages worship scheduling state including:
 * - Selected worship dates
 * - Services per date
 * - Schedule assignments
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export interface WorshipService {
  id: string;
  name: string;
  date: string; // ISO date string (YYYY-MM-DD)
  time?: string;
}

export interface ScheduledDate {
  date: string; // ISO date string
  services: WorshipService[];
}

/** Assignments for a single date - key is "instrumentId-slotIndex", value is memberId */
export type DateAssignments = Record<string, string>;

/** Instrument setup for a date */
export interface InstrumentSetup {
  enabled: boolean;
  count: number;
}

/** Full schedule data for a date */
export interface DateScheduleData {
  assignments: DateAssignments;
  instrumentSetups: Record<string, InstrumentSetup>;
  status: 'draft' | 'complete' | 'published';
  updatedAt: string;
}

interface SchedulingState {
  /** Selected worship dates (ISO strings) */
  selectedDates: string[];
  /** Current scheduling period title */
  periodTitle: string;
  /** Deadline for availability submissions */
  deadline: string | null;
  /** Whether dates have been confirmed and sent to team */
  isConfirmed: boolean;
  /** Currently viewing date in create-schedule */
  currentScheduleDate: string | null;
  /** Saved schedules by date */
  schedules: Record<string, DateScheduleData>;
}

interface SchedulingActions {
  /** Set selected worship dates */
  setSelectedDates: (dates: string[]) => void;
  /** Add a single date */
  addDate: (date: string) => void;
  /** Remove a single date */
  removeDate: (date: string) => void;
  /** Toggle a date selection */
  toggleDate: (date: string) => void;
  /** Clear all selected dates */
  clearDates: () => void;
  /** Set the period title */
  setPeriodTitle: (title: string) => void;
  /** Set deadline */
  setDeadline: (deadline: string | null) => void;
  /** Confirm dates and mark as sent to team */
  confirmDates: () => void;
  /** Set current schedule date being viewed */
  setCurrentScheduleDate: (date: string | null) => void;
  /** Navigate to next date */
  goToNextDate: () => void;
  /** Navigate to previous date */
  goToPrevDate: () => void;
  /** Save schedule for a date (optionally per service type) */
  saveSchedule: (date: string, data: Omit<DateScheduleData, 'updatedAt'>, serviceTypeId?: string) => void;
  /** Get schedule for a date (optionally per service type) */
  getSchedule: (date: string, serviceTypeId?: string) => DateScheduleData | null;
  /** Update schedule status (optionally per service type) */
  updateScheduleStatus: (date: string, status: DateScheduleData['status'], serviceTypeId?: string) => void;
  /** Clear schedule for a date (optionally per service type) */
  clearSchedule: (date: string, serviceTypeId?: string) => void;
  /** Reset scheduling state */
  reset: () => void;
}

interface SchedulingSelectors {
  /** Get sorted dates */
  getSortedDates: () => string[];
  /** Check if a date is selected */
  isDateSelected: (date: string) => boolean;
  /** Get count of selected dates */
  getDateCount: () => number;
  /** Check if there are any dates selected */
  hasDates: () => boolean;
  /** Get the current date index */
  getCurrentDateIndex: () => number;
}

export type SchedulingStore = SchedulingState & SchedulingActions & SchedulingSelectors;

// ============================================================================
// Initial State
// ============================================================================

const initialState: SchedulingState = {
  selectedDates: [],
  periodTitle: '',
  deadline: null,
  isConfirmed: false,
  currentScheduleDate: null,
  schedules: {},
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSchedulingStore = create<SchedulingStore>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

  // Actions
  setSelectedDates: (dates) => {
    const sorted = [...dates].sort();
    set({
      selectedDates: sorted,
      currentScheduleDate: sorted.length > 0 ? sorted[0] : null,
    });
  },

  addDate: (date) => {
    const { selectedDates } = get();
    if (!selectedDates.includes(date)) {
      const newDates = [...selectedDates, date].sort();
      set({
        selectedDates: newDates,
        currentScheduleDate: get().currentScheduleDate || newDates[0],
      });
    }
  },

  removeDate: (date) => {
    const { selectedDates, currentScheduleDate } = get();
    const newDates = selectedDates.filter((d) => d !== date);
    set({
      selectedDates: newDates,
      // If we removed the current date, move to the next one
      currentScheduleDate: currentScheduleDate === date
        ? (newDates[0] || null)
        : currentScheduleDate,
    });
  },

  toggleDate: (date) => {
    const { selectedDates } = get();
    if (selectedDates.includes(date)) {
      get().removeDate(date);
    } else {
      get().addDate(date);
    }
  },

  clearDates: () => {
    set({ selectedDates: [], currentScheduleDate: null, isConfirmed: false });
  },

  setPeriodTitle: (title) => {
    set({ periodTitle: title });
  },

  setDeadline: (deadline) => {
    set({ deadline });
  },

  confirmDates: () => {
    set({ isConfirmed: true });
  },

  setCurrentScheduleDate: (date) => {
    set({ currentScheduleDate: date });
  },

  goToNextDate: () => {
    const { selectedDates, currentScheduleDate } = get();
    if (!currentScheduleDate || selectedDates.length === 0) return;

    const sorted = [...selectedDates].sort();
    const currentIndex = sorted.indexOf(currentScheduleDate);
    if (currentIndex < sorted.length - 1) {
      set({ currentScheduleDate: sorted[currentIndex + 1] });
    }
  },

  goToPrevDate: () => {
    const { selectedDates, currentScheduleDate } = get();
    if (!currentScheduleDate || selectedDates.length === 0) return;

    const sorted = [...selectedDates].sort();
    const currentIndex = sorted.indexOf(currentScheduleDate);
    if (currentIndex > 0) {
      set({ currentScheduleDate: sorted[currentIndex - 1] });
    }
  },

  saveSchedule: (date, data, serviceTypeId) => {
    const { schedules } = get();
    // Use composite key if serviceTypeId is provided
    const key = serviceTypeId ? `${date}:${serviceTypeId}` : date;
    set({
      schedules: {
        ...schedules,
        [key]: {
          ...data,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  },

  getSchedule: (date, serviceTypeId) => {
    // Use composite key if serviceTypeId is provided
    const key = serviceTypeId ? `${date}:${serviceTypeId}` : date;
    return get().schedules[key] || null;
  },

  updateScheduleStatus: (date, status, serviceTypeId) => {
    const { schedules } = get();
    // Use composite key if serviceTypeId is provided
    const key = serviceTypeId ? `${date}:${serviceTypeId}` : date;
    const existing = schedules[key];
    if (existing) {
      set({
        schedules: {
          ...schedules,
          [key]: {
            ...existing,
            status,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  },

  clearSchedule: (date, serviceTypeId) => {
    const { schedules } = get();
    // Use composite key if serviceTypeId is provided
    const key = serviceTypeId ? `${date}:${serviceTypeId}` : date;
    const newSchedules = { ...schedules };
    delete newSchedules[key];
    set({ schedules: newSchedules });
  },

  reset: () => {
    set(initialState);
  },

  // Selectors
  getSortedDates: () => {
    return [...get().selectedDates].sort();
  },

  isDateSelected: (date) => {
    return get().selectedDates.includes(date);
  },

  getDateCount: () => {
    return get().selectedDates.length;
  },

  hasDates: () => {
    return get().selectedDates.length > 0;
  },

  getCurrentDateIndex: () => {
    const { selectedDates, currentScheduleDate } = get();
    if (!currentScheduleDate) return -1;
    const sorted = [...selectedDates].sort();
    return sorted.indexOf(currentScheduleDate);
  },
    }),
    {
      name: 'scheduling-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedDates: state.selectedDates,
        schedules: state.schedules,
        isConfirmed: state.isConfirmed,
        periodTitle: state.periodTitle,
        deadline: state.deadline,
      }),
    }
  )
);

// ============================================================================
// Hooks
// ============================================================================

export const useSelectedDates = () => useSchedulingStore((state) => state.selectedDates);
export const useCurrentScheduleDate = () => useSchedulingStore((state) => state.currentScheduleDate);
export const useIsConfirmed = () => useSchedulingStore((state) => state.isConfirmed);
