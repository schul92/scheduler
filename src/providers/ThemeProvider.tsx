/**
 * Theme Provider
 *
 * Provides theme colors globally to all components
 * Handles hydration from AsyncStorage properly
 */

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { useThemeStore } from '../store/themeStore';
import { lightColors, darkColors } from '../lib/theme';

type ThemeColors = typeof lightColors;

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  isHydrated: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark, toggleTheme } = useThemeStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for zustand to hydrate from AsyncStorage
  useEffect(() => {
    // zustand persist will update the store once hydrated
    // We check if the store is ready by subscribing to it
    const unsubscribe = useThemeStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    // If already hydrated (e.g., on re-render)
    if (useThemeStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      toggleTheme,
      isHydrated,
    }),
    [isDark, toggleTheme, isHydrated]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Fallback for when used outside provider (shouldn't happen)
    return {
      colors: lightColors,
      isDark: false,
      toggleTheme: () => {},
      isHydrated: false,
    };
  }
  return context;
}
