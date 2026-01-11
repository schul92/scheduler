/**
 * Root Layout
 *
 * Handles authentication state and routes to appropriate group
 */

import "../../global.css";
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase, getSession, getCurrentUserId } from '../lib/supabase';
import { useTeamStore } from '../store/teamStore';
import { ThemeProvider, useTheme } from '../providers/ThemeProvider';
import { LanguageProvider, useLanguage } from '../providers/LanguageProvider';
import { initSentry, setUser, clearUser, captureError, setTeamContext, clearTeamContext } from '../lib/sentry';
import { useNotifications } from '../hooks/useNotifications';
import { PostHogProvider } from 'posthog-react-native';
import Constants from 'expo-constants';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Check if running in Expo Go (session replay not supported)
const isExpoGo = Constants.appOwnership === 'expo';

// Initialize Sentry early
initSentry();

// PostHog configuration
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Timeout helper
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
};

// Track if we're currently fetching teams to prevent concurrent fetches
let isFetchingTeams = false;

// Inner layout component that uses theme and language
function RootLayoutInner() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { initialize, fetchTeams, hasTeams, teams } = useTeamStore();

  // Initialize push notifications when user is authenticated
  const { pushToken } = useNotifications();

  // Check authentication state
  useEffect(() => {
    const fetchTeamsWithGuard = async () => {
      if (isFetchingTeams) {
        console.log('[Auth] Already fetching teams, skipping...');
        return;
      }
      isFetchingTeams = true;
      try {
        await Promise.all([initialize(), fetchTeams()]);
      } finally {
        isFetchingTeams = false;
      }
    };

    const checkAuth = async () => {
      try {
        console.log('[Auth] Starting auth check...');

        // Use 15 second timeout for initial auth check (cold connection)
        const session = await withTimeout(getSession(), 15000);
        console.log('[Auth] Session:', session ? 'Found' : 'None');

        setIsAuthenticated(!!session);

        if (session) {
          console.log('[Auth] Initializing team store...');

          // Set Sentry user context
          const userId = await getCurrentUserId();
          if (userId) {
            setUser(userId, session.user?.email || undefined);
          }

          // Use 15 second timeout for team fetching too
          try {
            await withTimeout(fetchTeamsWithGuard(), 15000);
            console.log('[Auth] Team store initialized');
          } finally {
            setTeamsLoaded(true);
          }
        } else {
          // Not authenticated, no teams to load
          setTeamsLoaded(true);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log('[Auth] Auth check issue:', errorMsg);

        // Capture auth errors in Sentry (except timeouts which are expected)
        if (!errorMsg.includes('Timeout')) {
          captureError(error instanceof Error ? error : new Error(errorMsg), {
            context: 'auth_check',
          });
        }

        // Handle invalid refresh token - clear the stale session
        if (errorMsg.includes('Refresh Token') || errorMsg.includes('Invalid')) {
          console.log('[Auth] Invalid session detected, signing out...');
          await supabase.auth.signOut();
          clearUser();
        }

        // On any error (including timeout), assume not authenticated
        setIsAuthenticated(false);
        setTeamsLoaded(true);
      } finally {
        console.log('[Auth] Loading complete');
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Auth state changed:', event);

        // Skip TOKEN_REFRESHED events - they don't change auth state meaningfully
        if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Skipping team fetch for TOKEN_REFRESHED');
          return;
        }

        setIsAuthenticated(!!session);

        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          try {
            await withTimeout(fetchTeamsWithGuard(), 15000);
          } catch (error) {
            // Log quietly - timeout for new users with no teams is expected
            console.log('[Auth] Teams fetch skipped (timeout or new user):', error instanceof Error ? error.message : error);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle navigation based on auth state and team membership
  useEffect(() => {
    // Wait for both loading to complete AND teams to be loaded
    if (isLoading || !teamsLoaded) return;

    const segmentsList = segments as string[];
    const inAuthGroup = segmentsList[0] === '(auth)';
    const inMainGroup = segmentsList[0] === '(main)';
    const inJoinGroup = segmentsList.length > 1 && segmentsList[1] === 'join-group';
    const inProfileSetup = segmentsList.length > 1 && segmentsList[1] === 'profile-setup';
    const inServiceSetup = segmentsList.length > 1 && segmentsList[1] === 'service-setup';
    const inAuthScreen = segmentsList.length > 1 && segmentsList[1] === 'auth';
    const userHasTeams = hasTeams();

    console.log('[Nav] Auth:', isAuthenticated, 'HasTeams:', userHasTeams, 'TeamsLoaded:', teamsLoaded, 'Segments:', segments);

    // Don't redirect if user is in onboarding flow (profile-setup, service-setup, or auth screen)
    if (inProfileSetup || inServiceSetup || inAuthScreen) {
      console.log('[Nav] In onboarding flow, not redirecting');
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated, redirect to welcome
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup && !inJoinGroup) {
      // Authenticated user in auth group (except join-group for adding new team) → go to main tabs
      // User can add/join groups from settings
      router.replace('/(main)/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading, teamsLoaded, teams]);

  // Show loading screen while auth is checking or teams are loading
  if (isLoading || !teamsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common', 'loading')}
        </Text>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <> 
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

// Root layout with ThemeProvider, LanguageProvider, and PostHog wrappers
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <PostHogProvider
        apiKey={POSTHOG_API_KEY}
        options={{
          host: POSTHOG_HOST,
          // Temporarily enabled for testing - change to `__DEV__ || !POSTHOG_API_KEY` for production
          disabled: false,
          // Session replay - disabled in Expo Go (requires native modules)
          enableSessionReplay: !isExpoGo,
          ...(isExpoGo ? {} : {
            sessionReplayConfig: {
              maskAllTextInputs: true,
              maskAllImages: true,
              captureLog: true,
              captureNetworkTelemetry: true,
              throttleDelayMs: 1000,
            },
          }),
        }}
        autocapture
      >
        <ThemeProvider>
          <LanguageProvider>
            <RootLayoutInner />
          </LanguageProvider>
        </ThemeProvider>
      </PostHogProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});