/**
 * PraiseFlow Design System
 *
 * Centralized theme configuration based on Stitch designs
 */

import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// ============================================================================
// Colors - Light Mode
// ============================================================================

export const lightColors = {
  // Primary - Warm Gold/Tan
  primary: '#D4A574',
  primaryDark: '#B8956A',
  primaryLight: '#E8D4C4',

  // Background
  background: '#FDF8F3',
  surface: '#FFFFFF',
  warmWhite: '#FAFAFA',

  // Text
  textPrimary: '#2C3E50',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textLight: '#FFFFFF',

  // Status
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Team colors (for multi-team distinction)
  teamColors: [
    '#D4A574', // Gold (default)
    '#795548', // Brown
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#E91E63', // Pink
    '#00BCD4', // Teal
    '#9C27B0', // Purple
  ],
};

// ============================================================================
// Colors - Dark Mode
// ============================================================================

export const darkColors = {
  // Primary - Warm Gold/Tan (slightly brighter for dark mode)
  primary: '#E0B68A',
  primaryDark: '#D4A574',
  primaryLight: '#3D3020',

  // Background
  background: '#121212',
  surface: '#1E1E1E',
  warmWhite: '#181818',

  // Text
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  textLight: '#FFFFFF',

  // Status
  success: '#4ADE80',
  successLight: '#14532D',
  warning: '#FBBF24',
  warningLight: '#422006',
  error: '#F87171',
  errorLight: '#450A0A',
  info: '#60A5FA',
  infoLight: '#1E3A5F',

  // Borders
  border: '#333333',
  borderLight: '#2A2A2A',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // Team colors (for multi-team distinction)
  teamColors: [
    '#E0B68A', // Gold (default)
    '#8D6E63', // Brown
    '#42A5F5', // Blue
    '#66BB6A', // Green
    '#FFA726', // Orange
    '#EC407A', // Pink
    '#26C6DA', // Teal
    '#AB47BC', // Purple
  ],
};

// Default to light colors for backwards compatibility
export const colors = lightColors;

// Helper to get colors based on dark mode
export const getColors = (isDark: boolean) => isDark ? darkColors : lightColors;

// ============================================================================
// Spacing
// ============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ============================================================================
// Border Radius
// ============================================================================

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// ============================================================================
// Typography
// ============================================================================

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

export const typography = {
  fontSize,
  fontWeight,
  lineHeight,
};

// ============================================================================
// Shadows
// ============================================================================

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ============================================================================
// Layout
// ============================================================================

export const layout = {
  screenWidth: width,
  screenHeight: height,
  paddingHorizontal: 16,
  paddingVertical: 16,
  contentMaxWidth: 600,
  buttonHeight: 52,
  inputHeight: 52,
  headerHeight: 56,
  tabBarHeight: 85,
};

// ============================================================================
// Role Emojis
// ============================================================================

export const roleEmojis: Record<string, string> = {
  // Korean
  '인도자': '🎤',
  '보컬': '🎵',
  '피아노': '🎹',
  '건반': '🎹',
  '신디사이저': '🎹',
  '드럼': '🥁',
  '베이스': '🎸',
  '기타': '🎸',
  '어쿠스틱': '🎸',
  '일렉기타': '🎸',
  '바이올린': '🎻',
  '첼로': '🎻',
  '음향': '🔊',
  '자막': '📺',
  '방송': '📹',
  '조명': '💡',

  // English
  'Worship Leader': '🎤',
  'Vocal': '🎵',
  'Vocals': '🎵',
  'Piano': '🎹',
  'Keyboard': '🎹',
  'Synthesizer': '🎹',
  'Drums': '🥁',
  'Bass': '🎸',
  'Guitar': '🎸',
  'Acoustic': '🎸',
  'Electric Guitar': '🎸',
  'Violin': '🎻',
  'Cello': '🎻',
  'Sound': '🔊',
  'Lyrics': '📺',
  'Broadcasting': '📹',
  'Lighting': '💡',
};

export const getRoleEmoji = (roleName: string): string => {
  return roleEmojis[roleName] || '🎵';
};

// ============================================================================
// Status Colors
// ============================================================================

export const statusColors = {
  draft: {
    bg: colors.border,
    text: colors.textSecondary,
  },
  published: {
    bg: colors.successLight,
    text: colors.success,
  },
  completed: {
    bg: colors.infoLight,
    text: colors.info,
  },
  cancelled: {
    bg: colors.errorLight,
    text: colors.error,
  },
  pending: {
    bg: colors.warningLight,
    text: colors.warning,
  },
  confirmed: {
    bg: colors.successLight,
    text: colors.success,
  },
  declined: {
    bg: colors.errorLight,
    text: colors.error,
  },
};

// ============================================================================
// Legacy Exports (for backwards compatibility)
// ============================================================================

export const COLORS = colors;
export const SIZES = {
  ...spacing,
  ...layout,
  radiusSmall: borderRadius.sm,
  radiusMedium: borderRadius.md,
  radiusLarge: borderRadius.lg,
  radiusXL: borderRadius.xl,
  radiusFull: borderRadius.full,
};
export const SHADOWS = shadows;
