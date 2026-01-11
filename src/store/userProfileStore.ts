/**
 * User Profile Store
 *
 * Stores user's personal settings like selected parts/roles
 * Supports both predefined parts and custom user-created parts
 * Syncs parts to database team_members table
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getCurrentUserId } from '../lib/supabase';

export interface PartRole {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  isCustom?: boolean;
}

// Default available parts - includes both musical and production roles
export const DEFAULT_PARTS: PartRole[] = [
  // Musical roles
  { id: 'leader', name: '인도자', nameEn: 'Leader', emoji: '🎤' },
  { id: 'keyboard', name: '건반', nameEn: 'Keyboard', emoji: '🎹' },
  { id: 'synth', name: '신디사이저', nameEn: 'Synth', emoji: '🎛️' },
  { id: 'drums', name: '드럼', nameEn: 'Drums', emoji: '🥁' },
  { id: 'electric', name: '일렉기타', nameEn: 'E.Guitar', emoji: '🎸' },
  { id: 'bass', name: '베이스', nameEn: 'Bass', emoji: '🎻' },
  { id: 'acoustic', name: '어쿠스틱', nameEn: 'Acoustic', emoji: '🪕' },
  { id: 'violin', name: '바이올린', nameEn: 'Violin', emoji: '🎻' },
  { id: 'vocals', name: '싱어', nameEn: 'Vocals', emoji: '🎵' },
  // Production/Tech roles
  { id: 'pd', name: 'PD', nameEn: 'PD', emoji: '🎬' },
  { id: 'fd', name: 'FD', nameEn: 'FD', emoji: '📋' },
  { id: 'subtitles', name: '자막', nameEn: 'Subtitles', emoji: '💬' },
  { id: 'lighting', name: '조명', nameEn: 'Lighting', emoji: '💡' },
  { id: 'sound', name: '음향', nameEn: 'Sound', emoji: '🔊' },
  { id: 'camera', name: '카메라', nameEn: 'Camera', emoji: '📷' },
];

interface UserProfileState {
  /** User's selected part IDs */
  selectedParts: string[];
  /** User-created custom parts */
  customParts: PartRole[];
}

interface UserProfileActions {
  /** Set selected parts */
  setParts: (partIds: string[]) => void;
  /** Toggle a part */
  togglePart: (partId: string) => void;
  /** Add a custom part */
  addCustomPart: (name: string, emoji: string, id?: string) => string;
  /** Remove a custom part */
  removeCustomPart: (partId: string) => void;
  /** Get all available parts (default + custom) */
  getAllParts: () => PartRole[];
  /** Get full part details for selected */
  getSelectedPartDetails: () => PartRole[];
  /** Sync parts to database for all team memberships */
  syncPartsToDatabase: () => Promise<void>;
  /** Reset */
  reset: () => void;
}

export const useUserProfileStore = create<UserProfileState & UserProfileActions>()(
  persist(
    (set, get) => ({
      selectedParts: [],
      customParts: [],

      setParts: (partIds) => {
        set({ selectedParts: partIds });
      },

      togglePart: (partId) => {
        set((state) => {
          const current = state.selectedParts;
          if (current.includes(partId)) {
            return { selectedParts: current.filter(id => id !== partId) };
          } else {
            return { selectedParts: [...current, partId] };
          }
        });
      },

      addCustomPart: (name, emoji, providedId?) => {
        const id = providedId || `custom_${Date.now()}`;
        const newPart: PartRole = {
          id,
          name,
          nameEn: name, // Use same name for English
          emoji,
          isCustom: true,
        };
        set((state) => ({
          customParts: [...state.customParts, newPart],
          selectedParts: [...state.selectedParts, id], // Auto-select new custom part
        }));
        return id;
      },

      removeCustomPart: (partId) => {
        set((state) => ({
          customParts: state.customParts.filter(p => p.id !== partId),
          selectedParts: state.selectedParts.filter(id => id !== partId),
        }));
      },

      getAllParts: () => {
        const { customParts } = get();
        return [...DEFAULT_PARTS, ...customParts];
      },

      getSelectedPartDetails: () => {
        const { selectedParts } = get();
        const allParts = get().getAllParts();
        return allParts.filter(part => selectedParts.includes(part.id));
      },

      syncPartsToDatabase: async () => {
        const { selectedParts } = get();
        const userId = await getCurrentUserId();

        if (!userId) {
          console.log('No user ID, cannot sync parts to database');
          return;
        }

        try {
          // Update all team_members records for this user with their parts
          const { error } = await supabase
            .from('team_members')
            .update({ parts: selectedParts })
            .eq('user_id', userId);

          if (error) {
            console.error('Error syncing parts to database:', error);
          } else {
            console.log('Parts synced to database:', selectedParts);
          }
        } catch (err) {
          console.error('Failed to sync parts:', err);
        }
      },

      reset: () => {
        set({ selectedParts: [], customParts: [] });
      },
    }),
    {
      name: 'user-profile-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// For backwards compatibility, export old names as aliases
export const AVAILABLE_INSTRUMENTS = DEFAULT_PARTS;
