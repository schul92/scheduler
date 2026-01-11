/**
 * Team Routes Layout
 *
 * Layout for team-specific screens
 */

import { Stack } from 'expo-router';
import { colors, fontSize } from '../../../../lib/theme';

export default function TeamLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.lg },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerTitle: '팀 정보' }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="members"
        options={{ headerTitle: '멤버 관리' }}
      />
      <Stack.Screen
        name="services/index"
        options={{ headerTitle: '일정 목록' }}
      />
      <Stack.Screen
        name="services/[serviceId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="services/create"
        options={{ headerTitle: '새 일정' }}
      />
      <Stack.Screen
        name="set-dates"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="dates-overview"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="schedule-view"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="create-schedule"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="alerts"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="availability-status"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
