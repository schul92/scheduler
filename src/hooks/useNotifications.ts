/**
 * useNotifications Hook
 *
 * React hook for managing push notifications
 * Handles initialization, listeners, and deep linking
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  initializePushNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  getLastNotificationResponse,
} from '../lib/notifications';

interface NotificationData {
  type?: 'assignment' | 'reminder' | 'announcement';
  serviceId?: string;
  teamId?: string;
  date?: string;
}

interface UseNotificationsResult {
  pushToken: string | null;
  isRegistering: boolean;
  lastNotification: Notifications.Notification | null;
  refreshToken: () => Promise<void>;
}

/**
 * Hook for managing push notifications
 *
 * @returns Push token, registration status, and notification data
 *
 * @example
 * function MyComponent() {
 *   const { pushToken, isRegistering } = useNotifications();
 *
 *   if (isRegistering) {
 *     return <Text>Setting up notifications...</Text>;
 *   }
 *
 *   return <Text>Token: {pushToken || 'Not registered'}</Text>;
 * }
 */
export function useNotifications(): UseNotificationsResult {
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(true);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const receivedListenerRef = useRef<Notifications.EventSubscription | null>(null);

  // Handle notification tap (deep linking)
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData;

      console.log('[useNotifications] Notification tapped:', data);

      // Navigate based on notification type
      if (data.type === 'assignment' && data.teamId) {
        // Navigate to team home or schedule
        router.push('/(main)/(tabs)');
      }
    },
    [router]
  );

  // Handle notification received in foreground
  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      console.log('[useNotifications] Notification received:', notification.request.content);
      setLastNotification(notification);
    },
    []
  );

  // Initialize notifications on mount
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Register for push notifications
        const token = await initializePushNotifications();
        if (isMounted) {
          setPushToken(token);
          setIsRegistering(false);
        }

        // Check if app was opened from a notification
        const lastResponse = await getLastNotificationResponse();
        if (lastResponse && isMounted) {
          handleNotificationResponse(lastResponse);
        }
      } catch (error) {
        console.error('[useNotifications] Initialization error:', error);
        if (isMounted) {
          setIsRegistering(false);
        }
      }
    };

    initialize();

    // Set up listeners
    responseListenerRef.current = addNotificationResponseListener(handleNotificationResponse);
    receivedListenerRef.current = addNotificationReceivedListener(handleNotificationReceived);

    // Cleanup
    return () => {
      isMounted = false;
      responseListenerRef.current?.remove();
      receivedListenerRef.current?.remove();
    };
  }, [handleNotificationResponse, handleNotificationReceived]);

  // Refresh token function (can be called manually if needed)
  const refreshToken = useCallback(async () => {
    setIsRegistering(true);
    const token = await initializePushNotifications();
    setPushToken(token);
    setIsRegistering(false);
  }, []);

  return {
    pushToken,
    isRegistering,
    lastNotification,
    refreshToken,
  };
}

export default useNotifications;
