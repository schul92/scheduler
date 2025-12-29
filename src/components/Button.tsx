import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

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
  const getButtonStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: COLORS.primary,
          ...SHADOWS.primary,
        };
      case 'secondary':
        return {
          backgroundColor: COLORS.navy,
          ...SHADOWS.medium,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: COLORS.border,
        };
      case 'google':
        return {
          backgroundColor: COLORS.surfaceLight,
          borderWidth: 1,
          borderColor: COLORS.border,
          ...SHADOWS.small,
        };
      case 'apple':
        return {
          backgroundColor: '#000000',
          ...SHADOWS.medium,
        };
      default:
        return {};
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return { color: COLORS.navy };
      case 'secondary':
        return { color: COLORS.textLight };
      case 'outline':
        return { color: COLORS.navy };
      case 'google':
        return { color: COLORS.navy };
      case 'apple':
        return { color: COLORS.textLight };
      default:
        return {};
    }
  };

  const getIconColor = (): string => {
    switch (variant) {
      case 'primary':
        return COLORS.navy;
      case 'secondary':
      case 'apple':
        return COLORS.textLight;
      default:
        return COLORS.navy;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getIconColor()} />
      ) : (
        <View style={styles.content}>
          {iconComponent}
          {icon && !iconComponent && (
            <MaterialIcons
              name={icon}
              size={20}
              color={getIconColor()}
              style={styles.icon}
            />
          )}
          <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
          {variant === 'primary' && (
            <MaterialIcons
              name="arrow-forward"
              size={20}
              color={getIconColor()}
              style={styles.arrowIcon}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: SIZES.buttonHeight,
    borderRadius: SIZES.radiusMedium,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: SIZES.medium,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  icon: {
    marginRight: 4,
  },
  arrowIcon: {
    marginLeft: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});
