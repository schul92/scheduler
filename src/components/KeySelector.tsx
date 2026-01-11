/**
 * KeySelector Component
 *
 * A horizontal scrollable picker for musical keys.
 * Supports full chromatic scale with sharps and flats.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { spacing, borderRadius, fontSize } from '../lib/theme';

// Full chromatic scale with sharps/flats displayed together
const MUSICAL_KEYS = [
  { value: 'C', label: 'C' },
  { value: 'C#', label: 'C#/Db' },
  { value: 'D', label: 'D' },
  { value: 'D#', label: 'D#/Eb' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'F#', label: 'F#/Gb' },
  { value: 'G', label: 'G' },
  { value: 'G#', label: 'G#/Ab' },
  { value: 'A', label: 'A' },
  { value: 'A#', label: 'A#/Bb' },
  { value: 'B', label: 'B' },
];

interface KeySelectorProps {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

export function KeySelector({ value, onChange, disabled = false }: KeySelectorProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {MUSICAL_KEYS.map((key) => {
        const isSelected = value === key.value;
        return (
          <TouchableOpacity
            key={key.value}
            onPress={() => !disabled && onChange(key.value)}
            disabled={disabled}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? colors.primary : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
              },
              disabled && styles.disabled,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isSelected ? colors.textLight : colors.textPrimary,
                },
              ]}
            >
              {key.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default KeySelector;
