/**
 * Team Index Screen
 *
 * Redirects to main tabs - this route shouldn't be accessed directly
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../../providers/ThemeProvider';

export default function TeamIndexScreen() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors } = useTheme();

  useEffect(() => {
    // Redirect to main tabs - this page shouldn't be accessed directly
    // Use replace to avoid adding to navigation stack
    router.replace('/(main)/(tabs)');
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
