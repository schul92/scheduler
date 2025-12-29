/**
 * Supabase Client Configuration
 *
 * Typed Supabase client with React Native support
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session, User as AuthUser } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Database, User } from '../types/database.types';

// ============================================================================
// Environment Variables
// ============================================================================

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

// ============================================================================
// Supabase Client
// ============================================================================

/**
 * Typed Supabase client for PraiseFlow
 *
 * @example
 * // Query with full type inference
 * const { data } = await supabase
 *   .from('teams')
 *   .select('*')
 *   .single();
 * // data is typed as Tables<'teams'> | null
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// ============================================================================
// Auth Helper Functions
// ============================================================================

/**
 * Get the current session
 *
 * @returns The current session or null if not authenticated
 *
 * @example
 * const session = await getSession();
 * if (session) {
 *   console.log('User ID:', session.user.id);
 * }
 */
export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error.message);
    return null;
  }

  return session;
}

/**
 * Get the current authenticated user from Supabase Auth
 *
 * @returns The auth user or null if not authenticated
 *
 * @example
 * const authUser = await getAuthUser();
 * if (authUser) {
 *   console.log('Email:', authUser.email);
 * }
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting auth user:', error.message);
    return null;
  }

  return user;
}

/**
 * Get the current user's profile from the users table
 *
 * @returns The user profile or null if not found
 *
 * @example
 * const user = await getCurrentUser();
 * if (user) {
 *   console.log('Name:', user.full_name);
 *   console.log('Language:', user.preferred_language);
 * }
 */
export async function getCurrentUser(): Promise<User | null> {
  const authUser = await getAuthUser();

  if (!authUser) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error) {
    // User might not have a profile yet (handle_new_user trigger hasn't run)
    if (error.code === 'PGRST116') {
      console.warn('User profile not found, may need to wait for trigger');
      return null;
    }
    console.error('Error getting user profile:', error.message);
    return null;
  }

  return data;
}

/**
 * Get the current user's ID
 *
 * @returns The user ID or null if not authenticated
 *
 * @example
 * const userId = await getCurrentUserId();
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Check if the user is authenticated
 *
 * @returns True if authenticated, false otherwise
 *
 * @example
 * if (await isAuthenticated()) {
 *   // User is logged in
 * }
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Sign out the current user
 *
 * @returns Error if sign out failed, null otherwise
 *
 * @example
 * const error = await signOut();
 * if (error) {
 *   console.error('Sign out failed:', error.message);
 * }
 */
export async function signOut(): Promise<Error | null> {
  const { error } = await supabase.auth.signOut();
  return error;
}

// ============================================================================
// Database Query Helpers
// ============================================================================

/**
 * Create a typed query builder for a table
 * This is a convenience wrapper that provides better TypeScript inference
 *
 * @example
 * const teams = await from('teams')
 *   .select('*')
 *   .eq('owner_id', userId);
 */
export function from<T extends keyof Database['public']['Tables']>(table: T) {
  return supabase.from(table);
}

/**
 * Execute a database function
 *
 * @example
 * const { data, error } = await rpc('transfer_team_ownership', {
 *   p_team_id: teamId,
 *   p_new_owner_id: newOwnerId,
 * });
 */
export function rpc<T extends keyof Database['public']['Functions']>(
  fn: T,
  args: Database['public']['Functions'][T]['Args']
) {
  return supabase.rpc(fn, args);
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

/**
 * Subscribe to changes on a table
 *
 * @example
 * const subscription = subscribeToTable('services', 'team_id', teamId, (payload) => {
 *   console.log('Service changed:', payload);
 * });
 *
 * // Later, unsubscribe
 * subscription.unsubscribe();
 */
export function subscribeToTable<T extends keyof Database['public']['Tables']>(
  table: T,
  filterColumn: string,
  filterValue: string,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Database['public']['Tables'][T]['Row'] | null;
    old: Database['public']['Tables'][T]['Row'] | null;
  }) => void
) {
  return supabase
    .channel(`${table}_${filterColumn}_${filterValue}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        filter: `${filterColumn}=eq.${filterValue}`,
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Database['public']['Tables'][T]['Row'] | null,
          old: payload.old as Database['public']['Tables'][T]['Row'] | null,
        });
      }
    )
    .subscribe();
}

/**
 * Subscribe to all changes for the current user
 *
 * @example
 * const subscription = await subscribeToUserChanges(userId, (table, payload) => {
 *   console.log(`${table} changed:`, payload);
 * });
 */
export function subscribeToUserChanges(
  userId: string,
  callback: (
    table: string,
    payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    }
  ) => void
) {
  // Subscribe to user's service assignments
  const assignmentsChannel = supabase
    .channel(`user_${userId}_assignments`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_assignments',
      },
      (payload) => {
        callback('service_assignments', {
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Record<string, unknown> | null,
          old: payload.old as Record<string, unknown> | null,
        });
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      assignmentsChannel.unsubscribe();
    },
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type { Database, User };
