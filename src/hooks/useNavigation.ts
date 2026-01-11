/**
 * Safe Navigation Utilities
 *
 * Provides safe navigation functions that handle edge cases
 * like when there's no screen to go back to.
 */

import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Hook that provides safe navigation utilities
 *
 * @returns Safe navigation functions
 */
export function useSafeNavigation() {
  const router = useRouter();

  /**
   * Safely go back with a fallback route
   * If there's no screen to go back to, navigates to the fallback route
   *
   * @param fallback - The route to navigate to if can't go back (default: '/(main)/(tabs)')
   */
  const safeGoBack = useCallback((fallback: string = '/(main)/(tabs)') => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as any);
    }
  }, [router]);

  return { safeGoBack };
}

/**
 * Standalone function to safely go back
 * Use the hook version when possible for better integration with React
 *
 * @param router - The router instance from useRouter()
 * @param fallback - The route to navigate to if can't go back
 */
export function safeGoBack(
  router: ReturnType<typeof useRouter>,
  fallback: string = '/(main)/(tabs)'
) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
