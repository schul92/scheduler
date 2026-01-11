/**
 * Tabs Layout
 *
 * Bottom tab navigation with liquid glass effect and fluid animations
 * Inspired by iOS liquid glass design with sliding indicator
 */

import { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Pressable, Platform, Dimensions, LayoutChangeEvent } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeamStore } from '../../../store/teamStore';
import { useTheme } from '../../../providers/ThemeProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { spacing, fontSize, lightColors, borderRadius } from '../../../lib/theme';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TabBarProps = any;

// Static colors for StyleSheet
const staticColors = lightColors;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Glass effect configuration for consistent styling
const GLASS_CONFIG = {
  // Container
  containerRadius: 26,
  containerMargin: 20,
  containerBottomIOS: 28,
  containerBottomAndroid: 16,
  // Indicator
  indicatorInset: 6,
  indicatorRadius: 18,
  indicatorVerticalPadding: 6,
};

// Custom Tab Bar with Liquid Glass Effect and Sliding Indicator
function LiquidGlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  // Sliding indicator animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [tabWidth, setTabWidth] = useState(0);

  // Scale animations for each tab (native driver compatible)
  const tabScales = useRef(state.routes.map(() => new Animated.Value(1))).current;
  const iconScales = useRef(state.routes.map(() => new Animated.Value(1))).current;
  const iconLifts = useRef(state.routes.map((_: unknown, i: number) => new Animated.Value(state.index === i ? -2 : 0))).current;
  const labelScales = useRef(state.routes.map((_: unknown, i: number) => new Animated.Value(state.index === i ? 1 : 0.95))).current;
  const labelOpacities = useRef(state.routes.map((_: unknown, i: number) => new Animated.Value(state.index === i ? 1 : 0.6))).current;

  const tabLabels: Record<string, string> = {
    index: t('tabs', 'home'),
    members: t('tabs', 'members'),
    'my-calendar': t('tabs', 'myCalendar'),
    profile: t('tabs', 'profile'),
    schedule: t('tabs', 'management'),
  };

  const tabIcons: Record<string, { active: string; inactive: string }> = {
    index: { active: 'home', inactive: 'home-outline' },
    members: { active: 'people', inactive: 'people-outline' },
    'my-calendar': { active: 'calendar', inactive: 'calendar-outline' },
    profile: { active: 'person', inactive: 'person-outline' },
    schedule: { active: 'settings', inactive: 'settings-outline' },
  };

  // Calculate tab width on layout
  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    // Account for horizontal insets when calculating tab width
    const usableWidth = width - (GLASS_CONFIG.indicatorInset * 2);
    const calculatedTabWidth = usableWidth / state.routes.length;
    setTabWidth(calculatedTabWidth);
  };

  // Animate sliding indicator when tab changes
  useEffect(() => {
    if (tabWidth > 0) {
      // Animate the sliding bubble
      Animated.parallel([
        // Slide animation with spring for fluid feel
        Animated.spring(slideAnim, {
          toValue: state.index * tabWidth,
          useNativeDriver: true,
          tension: 68,
          friction: 12,
        }),
        // Subtle squeeze animation during transition
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
        ]),
      ]).start();

      // Animate each tab's appearance (all use native driver)
      state.routes.forEach((_: any, index: number) => {
        const isActive = state.index === index;
        Animated.parallel([
          Animated.spring(iconLifts[index], {
            toValue: isActive ? -2 : 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
          Animated.spring(labelScales[index], {
            toValue: isActive ? 1 : 0.95,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
          Animated.spring(labelOpacities[index], {
            toValue: isActive ? 1 : 0.6,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
        ]).start();
      });
    }
  }, [state.index, tabWidth]);

  // Handle press animations
  const handlePressIn = (index: number) => {
    Animated.parallel([
      Animated.spring(tabScales[index], {
        toValue: 0.9,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }),
      Animated.spring(iconScales[index], {
        toValue: 0.85,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      }),
    ]).start();
  };

  const handlePressOut = (index: number) => {
    Animated.parallel([
      Animated.spring(tabScales[index], {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 6,
      }),
      Animated.spring(iconScales[index], {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 6,
      }),
    ]).start();
  };

  return (
    <View style={styles.tabBarWrapper}>
      {/* Main glass container */}
      <View style={styles.tabBarContainer} onLayout={handleContainerLayout}>
        {/* Background gradient - creates depth */}
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(38, 38, 42, 0.92)',
                  'rgba(32, 32, 36, 0.96)',
                  'rgba(26, 26, 30, 0.98)',
                ]
              : [
                  'rgba(255, 255, 255, 0.88)',
                  'rgba(252, 252, 252, 0.94)',
                  'rgba(250, 250, 250, 0.98)',
                ]
          }
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.glassBackground, { borderRadius: GLASS_CONFIG.containerRadius }]}
        />

        {/* Top edge highlight - light refraction effect */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,1)', 'rgba(255,255,255,0)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.topEdgeHighlight, { borderTopLeftRadius: GLASS_CONFIG.containerRadius, borderTopRightRadius: GLASS_CONFIG.containerRadius }]}
        />

        {/* Subtle outer border for depth */}
        <View
          style={[
            styles.outerBorder,
            {
              borderColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.06)',
              borderRadius: GLASS_CONFIG.containerRadius,
            },
          ]}
        />

        {/* Sliding Indicator Bubble */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.slidingIndicator,
              {
                width: tabWidth - 2,
                top: GLASS_CONFIG.indicatorVerticalPadding,
                bottom: GLASS_CONFIG.indicatorVerticalPadding,
                borderRadius: GLASS_CONFIG.indicatorRadius,
                transform: [
                  { translateX: Animated.add(slideAnim, new Animated.Value(GLASS_CONFIG.indicatorInset + 1)) },
                  { scaleX: scaleAnim },
                  { scaleY: scaleAnim },
                ],
              },
            ]}
          >
            {/* Outer glow - subtle brand color aura */}
            <View
              style={[
                styles.indicatorGlow,
                {
                  backgroundColor: isDark
                    ? 'rgba(212, 165, 116, 0.15)'
                    : 'rgba(212, 165, 116, 0.2)',
                  borderRadius: GLASS_CONFIG.indicatorRadius + 2,
                },
              ]}
            />

            {/* Main glass body - solid and prominent */}
            <LinearGradient
              colors={
                isDark
                  ? [
                      'rgba(65, 65, 72, 1)',
                      'rgba(55, 55, 62, 1)',
                      'rgba(48, 48, 55, 1)',
                    ]
                  : [
                      'rgba(255, 255, 255, 1)',
                      'rgba(253, 253, 253, 1)',
                      'rgba(250, 250, 250, 1)',
                    ]
              }
              locations={[0, 0.4, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.indicatorGlass, { borderRadius: GLASS_CONFIG.indicatorRadius }]}
            />

            {/* Top highlight - crisp light refraction edge */}
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']
                  : ['rgba(255,255,255,1)', 'rgba(255,255,255,0.2)']
              }
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.5 }}
              style={[styles.indicatorHighlight, { borderRadius: GLASS_CONFIG.indicatorRadius }]}
            />

            {/* Inner border for glass depth */}
            <View
              style={[
                styles.indicatorBorder,
                {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(255,255,255,0.95)',
                  borderRadius: GLASS_CONFIG.indicatorRadius,
                },
              ]}
            />

            {/* Bottom edge shadow for lift effect */}
            <View
              style={[
                styles.indicatorBottomEdge,
                {
                  backgroundColor: isDark
                    ? 'rgba(0,0,0,0.3)'
                    : 'rgba(0,0,0,0.04)',
                  borderBottomLeftRadius: GLASS_CONFIG.indicatorRadius,
                  borderBottomRightRadius: GLASS_CONFIG.indicatorRadius,
                },
              ]}
            />
          </Animated.View>
        )}

        {/* Tab buttons */}
        <View style={styles.tabButtonsRow}>
          {state.routes.map((route: { key: string; name: string; params?: object }, index: number) => {
            const isFocused = state.index === index;
            const icons = tabIcons[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                onPressIn={() => handlePressIn(index)}
                onPressOut={() => handlePressOut(index)}
                style={styles.tabButton}
              >
                <Animated.View
                  style={[
                    styles.tabButtonInner,
                    {
                      transform: [{ scale: tabScales[index] }],
                    },
                  ]}
                >
                  {/* Icon with smooth lift animation */}
                  <Animated.View
                    style={{
                      transform: [
                        { scale: iconScales[index] },
                        { translateY: iconLifts[index] },
                      ],
                    }}
                  >
                    <Ionicons
                      name={(isFocused ? icons.active : icons.inactive) as any}
                      size={24}
                      color={isFocused ? colors.primary : colors.textMuted}
                    />
                  </Animated.View>

                  {/* Label with smooth scale and opacity */}
                  <Animated.Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isFocused ? colors.primary : colors.textMuted,
                        fontWeight: isFocused ? '600' : '400',
                        opacity: labelOpacities[index],
                        transform: [{ scale: labelScales[index] }],
                      },
                    ]}
                  >
                    {tabLabels[route.name] || route.name}
                  </Animated.Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// Header component with centered team name
function TeamSelectorHeader() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeTeam, teams } = useTeamStore();
  const team = activeTeam();

  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
      {/* Left spacer for balance */}
      <View style={styles.headerSide} />

      {/* Centered team selector */}
      <TouchableOpacity
        style={styles.teamSelector}
        onPress={() => {
          // TODO: Show team selector modal
        }}
      >
        <View
          style={[
            styles.teamColorDot,
            { backgroundColor: team?.color || colors.primary },
          ]}
        />
        <Text style={[styles.teamName, { color: colors.textPrimary }]} numberOfLines={1}>
          {team?.name || '팀 선택'}
        </Text>
        {teams.length > 1 && (
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        )}
      </TouchableOpacity>

      {/* Right side with notification button */}
      <View style={styles.headerSide}>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => {
            // TODO: Notifications
          }}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
      screenOptions={{
        headerStyle: [styles.header, { backgroundColor: colors.background }],
        headerTitleStyle: [styles.headerTitle, { color: colors.textPrimary }],
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          header: () => <TeamSelectorHeader />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: '팀원',
          header: () => <TeamSelectorHeader />,
        }}
      />
      <Tabs.Screen
        name="my-calendar"
        options={{
          title: '내 캘린더',
          headerTitle: '내 캘린더',
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          headerTitle: '프로필',
          headerTitleAlign: 'center',
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '관리',
          headerTitle: '관리',
          headerTitleAlign: 'center',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBarContainer: {
    marginHorizontal: GLASS_CONFIG.containerMargin,
    marginBottom: Platform.OS === 'ios' ? GLASS_CONFIG.containerBottomIOS : GLASS_CONFIG.containerBottomAndroid,
    borderRadius: GLASS_CONFIG.containerRadius,
    overflow: 'hidden',
    // Enhanced shadow for floating glass effect
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  topEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  outerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  // Sliding indicator styles
  slidingIndicator: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 0,
    // Inner shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  indicatorGlow: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.08 }],
  },
  indicatorGlass: {
    ...StyleSheet.absoluteFillObject,
  },
  indicatorHighlight: {
    position: 'absolute',
    top: 0,
    left: 3,
    right: 3,
    height: '45%',
  },
  indicatorBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  indicatorBottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 1,
  },
  tabButtonsRow: {
    flexDirection: 'row',
    paddingVertical: GLASS_CONFIG.indicatorVerticalPadding,
    paddingHorizontal: GLASS_CONFIG.indicatorInset,
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    minWidth: 44,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  header: {
    backgroundColor: staticColors.background,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: staticColors.textPrimary,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: staticColors.background,
  },
  headerSide: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  teamColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: staticColors.textPrimary,
    textAlign: 'center',
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
