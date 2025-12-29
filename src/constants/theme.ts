import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  // Primary colors
  primary: '#d4a573',
  primaryDark: '#c99a60',

  // Navy accent
  navy: '#2C3E50',
  navyLight: '#3d566e',

  // Backgrounds
  backgroundLight: '#f8f7f6',
  backgroundDark: '#1e1914',

  // Surface colors
  surfaceLight: '#ffffff',
  surfaceDark: '#2a2520',

  // Text colors
  textPrimary: '#2C3E50',
  textSecondary: '#8d7558',
  textMuted: '#a0a0a0',
  textLight: '#ffffff',

  // Status colors
  success: '#4CAF50',
  error: '#E57373',
  warning: '#FFB74D',

  // Border colors
  border: '#e4dcd3',
  borderDark: 'rgba(255, 255, 255, 0.1)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const FONTS = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
};

export const SIZES = {
  // Global sizes
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  extraLarge: 24,
  xxl: 32,
  xxxl: 40,

  // Screen dimensions
  width,
  height,

  // Padding
  paddingHorizontal: 24,
  paddingVertical: 16,

  // Border radius
  radiusSmall: 8,
  radiusMedium: 12,
  radiusLarge: 16,
  radiusXL: 24,
  radiusFull: 9999,

  // Button heights
  buttonHeight: 56,
  inputHeight: 56,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
};
