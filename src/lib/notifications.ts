/**
 * Push Notification Utilities
 *
 * Handles push notification registration, permissions, and token management
 * Uses Expo Push Notifications for cross-platform support
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase, getCurrentUserId } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and get the Expo push token
 *
 * @returns The Expo push token or null if registration failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    console.log('[Notifications] Got push token:', token.substring(0, 20) + '...');

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    return token;
  } catch (error) {
    console.error('[Notifications] Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Save the push token to Supabase
 *
 * @param token - The Expo push token
 * @returns Whether the save was successful
 */
export async function savePushToken(token: string): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[Notifications] No user logged in, skipping token save');
      return false;
    }

    const { error } = await supabase
      .from('users')
      .update({
        push_token: token,
        push_token_updated_at: new Date().toISOString(),
        device_type: Platform.OS,
      })
      .eq('id', userId);

    if (error) {
      console.error('[Notifications] Error saving push token:', error);
      return false;
    }

    console.log('[Notifications] Push token saved successfully');
    return true;
  } catch (error) {
    console.error('[Notifications] Error saving push token:', error);
    return false;
  }
}

/**
 * Clear the push token from Supabase (e.g., on logout)
 *
 * @returns Whether the clear was successful
 */
export async function clearPushToken(): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return false;
    }

    const { error } = await supabase
      .from('users')
      .update({
        push_token: null,
        push_token_updated_at: null,
        device_type: null,
      })
      .eq('id', userId);

    if (error) {
      console.error('[Notifications] Error clearing push token:', error);
      return false;
    }

    console.log('[Notifications] Push token cleared');
    return true;
  } catch (error) {
    console.error('[Notifications] Error clearing push token:', error);
    return false;
  }
}

/**
 * Initialize push notifications
 * Registers for push notifications and saves the token
 *
 * @returns The push token if successful, null otherwise
 */
export async function initializePushNotifications(): Promise<string | null> {
  const token = await registerForPushNotifications();
  if (token) {
    await savePushToken(token);
  }
  return token;
}

/**
 * Add a notification response listener
 * Called when user taps on a notification
 *
 * @param callback - Function to call when notification is tapped
 * @returns Subscription to remove the listener
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add a notification received listener
 * Called when notification is received while app is in foreground
 *
 * @param callback - Function to call when notification is received
 * @returns Subscription to remove the listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Get the last notification response (if app was opened from notification)
 *
 * @returns The last notification response or null
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Send a local notification (for testing)
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data to include
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Show immediately
  });
}
