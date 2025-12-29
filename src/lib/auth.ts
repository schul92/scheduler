import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';

// Required for web OAuth
if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// Get redirect URL based on platform
const getRedirectUrl = () => {
  if (Platform.OS === 'web') {
    return window.location.origin;
  }
  // For mobile, use the app's custom URL scheme
  return 'scheduler://auth/callback';
};

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        initialized: true,
      });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
        }));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
};

// Google OAuth
export const signInWithGoogle = async (): Promise<{ error: AuthError | Error | null }> => {
  try {
    const redirectUrl = getRedirectUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: Platform.OS !== 'web',
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return { error };
    }

    if (Platform.OS !== 'web' && data.url) {
      // Open browser for mobile OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        {
          showInRecents: true,
          preferEphemeralSession: false,
        }
      );

      if (result.type === 'success' && result.url) {
        // Extract tokens from URL
        const url = new URL(result.url);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          return { error: sessionError };
        }
      }

      if (result.type === 'cancel') {
        return { error: new Error('User cancelled authentication') };
      }
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};

// Apple OAuth
export const signInWithApple = async (): Promise<{ error: AuthError | Error | null }> => {
  try {
    if (Platform.OS === 'ios') {
      // Native Apple Sign In for iOS
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        return { error };
      }

      return { error: new Error('No identity token received from Apple') };
    } else if (Platform.OS === 'web') {
      // Web-based Apple Sign In
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: getRedirectUrl(),
        },
      });
      return { error };
    } else {
      // Android - use web-based flow
      const redirectUrl = getRedirectUrl();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return { error };
      }

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            return { error: sessionError };
          }
        }
      }

      return { error: null };
    }
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { error: new Error('User cancelled authentication') };
    }
    return { error: error as Error };
  }
};

// Email Sign In
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ error: AuthError | null }> => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error };
};

// Email Sign Up
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<{ error: AuthError | null }> => {
  const redirectUrl = getRedirectUrl();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });
  return { error };
};

// Sign Out
export const signOut = async (): Promise<{ error: AuthError | null }> => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Check if Apple Auth is available (iOS only)
export const isAppleAuthAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return true; // We'll use web-based flow for other platforms
  }
  return await AppleAuthentication.isAvailableAsync();
};
