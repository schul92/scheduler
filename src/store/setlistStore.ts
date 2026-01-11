/**
 * Setlist Store
 *
 * Manages worship service setlists (콘티) including:
 * - Songs with title, key, and optional YouTube link
 * - Per-date setlist management
 * - Song ordering and CRUD operations
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export interface Song {
  id: string;
  title: string;
  key: string;
  youtubeUrl?: string;
  order: number;
}

interface SetlistState {
  /** Setlists by date - key is ISO date string (YYYY-MM-DD) */
  setlists: Record<string, Song[]>;
}

interface SetlistActions {
  /** Add a song to a date's setlist */
  addSong: (date: string, song: Omit<Song, 'id' | 'order'>) => void;
  /** Remove a song from a date's setlist */
  removeSong: (date: string, songId: string) => void;
  /** Update a song's properties */
  updateSong: (date: string, songId: string, updates: Partial<Omit<Song, 'id'>>) => void;
  /** Reorder songs within a setlist */
  reorderSongs: (date: string, fromIndex: number, toIndex: number) => void;
  /** Get setlist for a specific date */
  getSetlist: (date: string) => Song[];
  /** Clear setlist for a date */
  clearSetlist: (date: string) => void;
  /** Reset all setlists */
  reset: () => void;
}

interface SetlistSelectors {
  /** Check if a date has any songs */
  hasSetlist: (date: string) => boolean;
  /** Get song count for a date */
  getSongCount: (date: string) => number;
}

export type SetlistStore = SetlistState & SetlistActions & SetlistSelectors;

// ============================================================================
// Helpers
// ============================================================================

const generateId = () => `song-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================================================
// Initial State
// ============================================================================

const initialState: SetlistState = {
  setlists: {},
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSetlistStore = create<SetlistStore>((set, get) => ({
  // State
  ...initialState,

  // Actions
  addSong: (date, songData) => {
    const { setlists } = get();
    const currentSetlist = setlists[date] || [];
    const newSong: Song = {
      ...songData,
      id: generateId(),
      order: currentSetlist.length,
    };

    set({
      setlists: {
        ...setlists,
        [date]: [...currentSetlist, newSong],
      },
    });
  },

  removeSong: (date, songId) => {
    const { setlists } = get();
    const currentSetlist = setlists[date] || [];
    const updatedSetlist = currentSetlist
      .filter((song) => song.id !== songId)
      .map((song, index) => ({ ...song, order: index }));

    set({
      setlists: {
        ...setlists,
        [date]: updatedSetlist,
      },
    });
  },

  updateSong: (date, songId, updates) => {
    const { setlists } = get();
    const currentSetlist = setlists[date] || [];
    const updatedSetlist = currentSetlist.map((song) =>
      song.id === songId ? { ...song, ...updates } : song
    );

    set({
      setlists: {
        ...setlists,
        [date]: updatedSetlist,
      },
    });
  },

  reorderSongs: (date, fromIndex, toIndex) => {
    const { setlists } = get();
    const currentSetlist = [...(setlists[date] || [])];

    if (fromIndex < 0 || fromIndex >= currentSetlist.length) return;
    if (toIndex < 0 || toIndex >= currentSetlist.length) return;

    const [movedSong] = currentSetlist.splice(fromIndex, 1);
    currentSetlist.splice(toIndex, 0, movedSong);

    // Update order values
    const reorderedSetlist = currentSetlist.map((song, index) => ({
      ...song,
      order: index,
    }));

    set({
      setlists: {
        ...setlists,
        [date]: reorderedSetlist,
      },
    });
  },

  getSetlist: (date) => {
    const { setlists } = get();
    return (setlists[date] || []).sort((a, b) => a.order - b.order);
  },

  clearSetlist: (date) => {
    const { setlists } = get();
    const newSetlists = { ...setlists };
    delete newSetlists[date];
    set({ setlists: newSetlists });
  },

  reset: () => {
    set(initialState);
  },

  // Selectors
  hasSetlist: (date) => {
    const { setlists } = get();
    return (setlists[date]?.length || 0) > 0;
  },

  getSongCount: (date) => {
    const { setlists } = get();
    return setlists[date]?.length || 0;
  },
}));

// ============================================================================
// Hooks
// ============================================================================

export const useSetlist = (date: string) =>
  useSetlistStore((state) => state.getSetlist(date));

export const useHasSetlist = (date: string) =>
  useSetlistStore((state) => state.hasSetlist(date));
