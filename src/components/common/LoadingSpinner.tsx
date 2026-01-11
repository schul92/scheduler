/**
 * LoadingSpinner Component
 *
 * Consistent loading indicator used across the app
 */

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider';
import { useLanguage } from '../../providers/LanguageProvider';
import { spacing, fontSize } from '../../lib/theme';

interface LoadingSpinnerProps {
  /** Size of the spinner: 'small' | 'large' */
  size?: 'small' | 'large';
  /** Show loading text below spinner */
  showText?: boolean;
  /** Custom loading text (overrides default) */
  text?: string;
  /** Full screen centered or inline */
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'large',
  showText = true,
  text,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();

  const defaultText = language === 'ko' ? '로딩 중...' : 'Loading...';

  if (fullScreen) {
    return (
      <View style={[styles.fullScreenContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size={size} color={colors.primary} />
        {showText && (
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {text || defaultText}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.inlineContainer}>
      <ActivityIndicator size={size} color={colors.primary} />
      {showText && (
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {text || defaultText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  inlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
});

export default LoadingSpinner;
