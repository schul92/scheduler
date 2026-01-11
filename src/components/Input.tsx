/**
 * Input Component
 *
 * Refactored to use NativeWind v4 with Tailwind CSS classes
 * Uses clsx for conditional styling based on focus and error states
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import clsx from 'clsx';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  icon,
  error,
  containerStyle,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Dynamic icon color based on focus state
  const iconColor = isFocused ? '#D4A574' : '#6B7280';

  return (
    <View className="w-full gap-2" style={containerStyle}>
      {label && (
        <Text className="text-sm font-semibold text-text-primary ml-1">
          {label}
        </Text>
      )}
      <View
        className={clsx(
          // Base styles
          'flex-row items-center h-[52px] bg-surface rounded-md px-md',
          // Border styles - conditional based on state
          'border',
          {
            // Default state
            'border-border': !isFocused && !error,
            // Focused state
            'border-primary border-2': isFocused && !error,
            // Error state
            'border-error': error,
          }
        )}
      >
        {icon && (
          <MaterialIcons
            name={icon}
            size={24}
            color={iconColor}
            style={{ marginRight: 12 }}
          />
        )}
        <TextInput
          className={clsx(
            'flex-1 text-lg font-medium text-text-primary tracking-wide',
            icon && 'pl-0'
          )}
          placeholderTextColor="#9CA3AF"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
      {error && (
        <Text className="text-sm text-error ml-1">
          {error}
        </Text>
      )}
    </View>
  );
};
