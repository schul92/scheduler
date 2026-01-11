/**
 * Create Service Screen
 *
 * Placeholder - create new service
 */

import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize } from '../../../../../lib/theme';

export default function CreateServiceScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>새 일정 만들기</Text>
        <Text style={styles.subtitle}>Team ID: {teamId}</Text>
        <Text style={styles.placeholder}>이 화면은 개발 중입니다</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
