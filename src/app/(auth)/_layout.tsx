/**
 * Auth Group Layout
 *
 * Layout for authentication screens (welcome, login, signup, etc.)
 */

import { Stack } from 'expo-router';

const COLORS = {
  background: '#FDF8F3',
  text: '#2C3E50',
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="join-group" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="service-setup" />
    </Stack>
  );
}
