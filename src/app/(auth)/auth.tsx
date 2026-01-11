/**
 * Auth Screen - Login/Signup
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { useTeamStore } from '../../store/teamStore';
import { colors, spacing, borderRadius, fontSize } from '../../lib/theme';
import { useAnalytics } from '../../lib/analytics';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    groupCode?: string;
    groupName?: string;
    mode?: 'join' | 'create';
  }>();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState('');
  const { joinTeamByCode, createTeam, teams, fetchTeams } = useTeamStore();
  const { identify, trackLogin } = useAnalytics();

  // Prevent duplicate handlePostAuth calls
  const isProcessingRef = useRef(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  // Start animations when loading
  useEffect(() => {
    if (isLoading) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotate animation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Dot animation for loading text
      Animated.loop(
        Animated.timing(dotAnim, {
          toValue: 3,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
      dotAnim.setValue(0);
    }
  }, [isLoading]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setLoadingStatus('Google 계정 연결 중...');
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'scheduler://auth/callback',
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (authError) throw authError;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          'scheduler://auth/callback'
        );

        if (result.type === 'success' && result.url) {
          setLoadingStatus('인증 확인 중...');

          // Extract tokens from the redirect URL
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1)); // Remove # prefix
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            setLoadingStatus('세션 생성 중...');

            // Set the session manually
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) throw sessionError;
            if (!sessionData?.session) throw new Error('Session not created');

            // Track login in PostHog
            trackLogin('google');

            // Now handle post-auth actions - pass session directly to avoid extra getSession call
            await handlePostAuth(sessionData.session);
          } else {
            throw new Error('Missing tokens in callback URL');
          }
        }
      }
    } catch (err) {
      console.error('Google auth error:', err);
      setError('로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostAuth = async (session: any) => {
    // Prevent duplicate calls
    if (isProcessingRef.current) {
      console.log('[Auth] handlePostAuth already in progress, skipping');
      return;
    }
    isProcessingRef.current = true;

    try {
      console.log('[Auth] Starting post-auth processing...');
      const startTime = Date.now();

      if (!session) {
        setError('세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }

      const userId = session.user.id;
      const userEmail = session.user.email || '';
      const userName = session.user.user_metadata?.full_name ||
                       session.user.user_metadata?.name || '';

      // Identify user in PostHog for analytics
      identify(userId, {
        email: userEmail,
        name: userName,
      });

      // Run ensureUserExists - fetchTeams is skipped for new users
      setLoadingStatus('계정 확인 중...');
      console.log('[Auth] Checking user exists...');
      const t1 = Date.now();
      const userExistsResult = await ensureUserExistsFast(userId, userEmail, userName);
      console.log('[Auth] ensureUserExists:', Date.now() - t1, 'ms');

      // Only fetch teams if this is NOT a new user creating their first team
      if (params.mode !== 'create') {
        setLoadingStatus('그룹 정보 불러오는 중...');
        const t2 = Date.now();
        await fetchTeams();
        console.log('[Auth] fetchTeams:', Date.now() - t2, 'ms');
      }

      if (!userExistsResult) {
        setError('사용자 정보 생성에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      const existingTeams = useTeamStore.getState().teams;
      console.log('[Auth] Existing teams:', existingTeams.length);

      // Handle group join/create based on params
      if (params.mode === 'join' && params.groupCode) {
        setLoadingStatus('그룹에 참여하는 중...');
        console.log('[Auth] Joining team with code:', params.groupCode);
        const team = await joinTeamByCode(params.groupCode);
        if (!team) {
          setError('유효하지 않은 그룹 코드입니다.');
          return;
        }
        // Member joining - skip fetchTeams, pass role directly (faster)
        setLoadingStatus('설정 화면으로 이동 중...');
        console.log('[Auth] Total post-auth time:', Date.now() - startTime, 'ms');
        router.replace('/(auth)/profile-setup?role=member');
      } else if (params.mode === 'create' && params.groupName) {
        // Check if team with same name already exists for this user
        const teamExists = existingTeams.some(t => t.name === params.groupName);
        if (teamExists) {
          console.log('[Auth] Team already exists, skipping creation');
        } else {
          setLoadingStatus('그룹 생성 중...');
          console.log('[Auth] Creating team:', params.groupName);
          const team = await createTeam(params.groupName);
          console.log('[Auth] Create team result:', team);
          if (!team) {
            const storeError = useTeamStore.getState().error;
            console.error('[Auth] Team creation failed:', storeError);
            setError(`그룹 생성에 실패했습니다: ${storeError || '알 수 없는 오류'}`);
            return;
          }
          // Skip fetchTeams - we know user is owner (faster)
        }
        // Leader creating - pass role directly
        setLoadingStatus('설정 화면으로 이동 중...');
        console.log('[Auth] Total post-auth time:', Date.now() - startTime, 'ms');
        router.replace('/(auth)/profile-setup?role=owner');
      } else {
        // No mode specified (clicked "로그인" directly)
        // Fetch teams to check if returning user or new user
        setLoadingStatus('사용자 정보 확인 중...');
        await fetchTeams();
        const userTeams = useTeamStore.getState().teams;
        console.log('[Auth] Direct login - user has', userTeams.length, 'teams');
        console.log('[Auth] Total post-auth time:', Date.now() - startTime, 'ms');

        if (userTeams.length > 0) {
          // Returning user with teams - go to main app
          router.replace('/(main)/(tabs)');
        } else {
          // New user with no teams - ask them to create or join
          router.replace('/(auth)/join-group');
        }
      }
    } catch (err) {
      console.error('Post-auth error:', err);
      setError(`처리 중 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Optimized version that skips redundant getAuthUser call
  const ensureUserExistsFast = async (userId: string, email: string, fullName: string): Promise<boolean> => {
    // Check if user exists in public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      return true;
    }

    // User doesn't exist, create them
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
      });

    if (insertError) {
      // Might fail due to race condition with trigger - that's ok
      if (insertError.code === '23505') {
        return true;
      }
      console.error('[Auth] ensureUserExistsFast: Insert failed:', insertError);
      return false;
    }

    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>로그인</Text>
        <Text style={styles.subtitle}>
          계정으로 로그인하여 계속하세요
        </Text>

        {params.mode === 'join' && params.groupCode && (
          <View style={styles.infoBox}>
            <Ionicons name="people" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              그룹 코드: {params.groupCode}
            </Text>
          </View>
        )}

        {params.mode === 'create' && params.groupName && (
          <View style={styles.infoBox}>
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              새 그룹: {params.groupName}
            </Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.buttonContainer}>
          {/* Google Sign In */}
          <TouchableOpacity
            style={[styles.authButton, styles.googleButton]}
            onPress={handleGoogleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={colors.textLight} />
                <Text style={styles.authButtonText}>Google로 계속</Text>
              </>
            )}
          </TouchableOpacity>

        </View>

        <Text style={styles.termsText}>
          계속하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
        </Text>
      </View>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            {/* Animated Icon */}
            <Animated.View
              style={[
                styles.loadingIconContainer,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="musical-notes" size={48} color={colors.primary} />
              </Animated.View>
            </Animated.View>

            {/* Status Text */}
            <Text style={styles.loadingTitle}>잠시만 기다려주세요</Text>
            <Text style={styles.loadingStatus}>{loadingStatus}</Text>

            {/* Progress Dots */}
            <View style={styles.dotsContainer}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      opacity: dotAnim.interpolate({
                        inputRange: [i, i + 0.5, i + 1, 3],
                        outputRange: [0.3, 1, 0.3, 0.3],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
  },
  buttonContainer: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  authButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textLight,
  },
  termsText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  // Loading Overlay Styles
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  loadingTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  loadingStatus: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
