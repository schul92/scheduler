/**
 * Button Component
 *
 * Refactored to use NativeWind v4 with Tailwind CSS classes
 * Uses clsx for variant-based conditional styling
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'google' | 'apple';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconComponent?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// Variant-based button container classes
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary shadow-primary',
  secondary: 'bg-text-primary shadow-md',
  outline: 'bg-transparent border-2 border-border',
  google: 'bg-surface border border-border shadow-sm',
  apple: 'bg-black shadow-md',
};

// Variant-based text classes
const textVariants: Record<ButtonVariant, string> = {
  primary: 'text-text-primary',
  secondary: 'text-white',
  outline: 'text-text-primary',
  google: 'text-text-primary',
  apple: 'text-white',
};

// Icon colors for ActivityIndicator and MaterialIcons
const iconColors: Record<ButtonVariant, string> = {
  primary: '#2C3E50',
  secondary: '#FFFFFF',
  outline: '#2C3E50',
  google: '#2C3E50',
  apple: '#FFFFFF',
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  iconComponent,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const iconColor = iconColors[variant];

  return (
    <TouchableOpacity
      className={clsx(
        // Base styles
        'h-[52px] rounded-md justify-center items-center w-full',
        // Variant styles
        buttonVariants[variant],
        // Disabled state
        disabled && 'opacity-50'
      )}
      style={style}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {iconComponent}
          {icon && !iconComponent && (
            <MaterialIcons
              name={icon}
              size={20}
              color={iconColor}
              className="mr-1"
            />
          )}
          <Text
            className={clsx(
              // Base text styles
              'text-base font-bold tracking-wide',
              // Variant text styles
              textVariants[variant]
            )}
            style={textStyle}
          >
            {title}
          </Text>
          {variant === 'primary' && (
            <MaterialIcons
              name="arrow-forward"
              size={20}
              color={iconColor}
              className="ml-1"
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};
