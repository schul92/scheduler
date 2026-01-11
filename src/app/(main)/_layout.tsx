/**
 * Main App Layout
 *
 * Protected routes wrapper - requires authentication
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { useTeamStore } from '../../store/teamStore';

const COLORS = {
  background: '#FDF8F3',
  primary: '#D4A574',
  text: '#2C3E50',
  textLight: '#6B7280',
};

export default function MainLayout() {
  const router = useRouter();
  const {
    teams,
    isLoading,
    initialized,
    initialize,
    fetchTeams,
    hasTeams,
  } = useTeamStore();

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      try {
        if (!initialized) {
          await initialize();
        }
        await fetchTeams();
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize:', error);
        setIsReady(true);
      }
    };

    setup();
  }, []);

  // Show loading while initializing
  if (!isReady || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  // If user has no teams, they might need to join/create one
  // This is handled in the tabs layout for better UX

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
});
