/**
 * Language Provider
 *
 * Provides language and translation functions globally
 */

import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react';
import { useLanguageStore, Language } from '../store/languageStore';
import { translations, t as translate, tArray as translateArray } from '../lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (section: keyof typeof translations, key: string) => string;
  tArray: (section: keyof typeof translations, key: string, subKey: string) => string[];
  isHydrated: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguageStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for zustand to hydrate from AsyncStorage
  useEffect(() => {
    const unsubscribe = useLanguageStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    if (useLanguageStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Memoized translation function
  const t = useCallback(
    (section: keyof typeof translations, key: string): string => {
      return translate(section, key, language);
    },
    [language]
  );

  // Memoized array translation function
  const tArray = useCallback(
    (section: keyof typeof translations, key: string, subKey: string): string[] => {
      return translateArray(section, key, subKey, language);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      tArray,
      isHydrated,
    }),
    [language, setLanguage, t, tArray, isHydrated]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    // Fallback for when used outside provider
    return {
      language: 'ko' as Language,
      setLanguage: () => {},
      t: (section: keyof typeof translations, key: string) => translate(section, key, 'ko'),
      tArray: (section: keyof typeof translations, key: string, subKey: string) => translateArray(section, key, subKey, 'ko'),
      isHydrated: false,
    };
  }
  return context;
}
