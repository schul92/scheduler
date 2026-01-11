/**
 * My Calendar Tab Screen
 *
 * Shows calendar with dates where the member is ASSIGNED to play.
 * Read-only schedule view - no availability response UI here.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePersonalCalendar } from '../../../hooks/usePersonalCalendar';
import { useTheme } from '../../../providers/ThemeProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { spacing, borderRadius, fontSize, shadows } from '../../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Role emoji mapping
const ROLE_EMOJI: Record<string, string> = {
  'leader': '🎤',
  'keyboard': '🎹',
  'keys': '🎹',
  'synth': '🎛️',
  'drums': '🥁',
  'electric': '🎸',
  'bass': '🎻',
  'vocals': '🎵',
  'acoustic': '🪕',
  'guitar': '🎸',
};

// Helper to format date as YYYY-MM-DD in local timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to parse YYYY-MM-DD string as local date
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function MyCalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const slideAnim = useRef(new Animated.Value(0)).current;

  const { entries, entriesByDate, isLoading, refetch } = usePersonalCalendar(currentMonth);

  // Refetch calendar data when screen is focused (after login, switching tabs, etc.)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const WEEKDAYS = language === 'ko' ? WEEKDAYS_KO : WEEKDAYS_EN;

  // Toggle date selection (multi-select)
  const toggleDateSelection = (date: string) => {
    setSelectedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Clear all selections
  const clearSelections = () => {
    setSelectedDates(new Set());
  };

  // Select all dates with assignments in current month
  const selectAllAssigned = () => {
    setSelectedDates(new Set(assignedDatesSet));
  };

  // Get dates with assignments
  const assignedDatesSet = useMemo(() => {
    const dates = new Set<string>();
    entries.forEach(entry => {
      if (entry.assignment) {
        dates.add(entry.date);
      }
    });
    return dates;
  }, [entries]);

  // Animate panel when dates selected
  useEffect(() => {
    if (selectedDates.size > 0) {
      slideAnim.setValue(20);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  }, [selectedDates.size]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    // Previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 1, day);
      days.push({ date: formatLocalDate(date), day, isCurrentMonth: false });
    }

    // Current month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      days.push({ date: formatLocalDate(date), day, isCurrentMonth: true });
    }

    // Next month
    const remainingDays = Math.ceil(days.length / 7) * 7 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date: formatLocalDate(date), day, isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  const today = formatLocalDate(new Date());
  const isCurrentMonthToday = currentMonth.getMonth() === new Date().getMonth() &&
                              currentMonth.getFullYear() === new Date().getFullYear();

  // Go to today
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDates(new Set([today]));
  };

  // Format helpers
  const formatSelectedDatesHeader = () => {
    if (selectedDates.size === 0) return '';
    if (selectedDates.size === 1) {
      const dateStr = Array.from(selectedDates)[0];
      const date = parseLocalDate(dateStr);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      if (language === 'ko') {
        return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    }
    // Multiple dates selected
    return language === 'ko'
      ? `${selectedDates.size}개 날짜 선택됨`
      : `${selectedDates.size} dates selected`;
  };

  const formatMonthYear = () => {
    if (language === 'ko') {
      return `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
    }
    return currentMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Get role emoji
  const getRoleEmoji = (roleName: string) => {
    const lowerName = roleName.toLowerCase();
    for (const [key, emoji] of Object.entries(ROLE_EMOJI)) {
      if (lowerName.includes(key)) {
        return emoji;
      }
    }
    return '🎵';
  };

  // Get assignments for all selected dates (grouped by date)
  const selectedDatesAssignments = useMemo(() => {
    const result: { date: string; entries: typeof entries }[] = [];
    const sortedDates = Array.from(selectedDates).sort();

    for (const date of sortedDates) {
      const dateEntries = entriesByDate.get(date) || [];
      const assignments = dateEntries.filter(entry => entry.assignment);
      if (assignments.length > 0) {
        result.push({ date, entries: assignments });
      }
    }
    return result;
  }, [selectedDates, entriesByDate]);

  // Total assignments count
  const totalSelectedAssignments = selectedDatesAssignments.reduce(
    (sum, d) => sum + d.entries.length, 0
  );

  // Count this month's assignments
  const thisMonthAssignmentCount = useMemo(() => {
    return entries.filter(e => e.assignment).length;
  }, [entries]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header - Month Navigation Only */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Month Navigation */}
        <View style={styles.monthNavRow}>
          {!isCurrentMonthToday ? (
            <TouchableOpacity
              style={[styles.todayBtn, { backgroundColor: colors.primary + '15' }]}
              onPress={goToToday}
            >
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>
                {language === 'ko' ? '오늘' : 'Today'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.todayBtnPlaceholder} />
          )}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              style={styles.monthNavBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>{formatMonthYear()}</Text>
            <TouchableOpacity
              onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              style={styles.monthNavBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.todayBtnPlaceholder} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Calendar Grid */}
        <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}>
          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {language === 'ko' ? '로딩 중...' : 'Loading...'}
              </Text>
            </View>
          )}

          {/* Weekdays */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day, i) => (
              <View key={day + i} style={styles.weekdayCell}>
                <Text style={[
                  styles.weekdayText,
                  { color: colors.textMuted },
                  i === 0 && { color: colors.error },
                  i === 6 && { color: colors.info },
                ]}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const isToday = day.date === today;
              const isSelected = selectedDates.has(day.date);
              const dayOfWeek = index % 7;
              const hasAssignment = assignedDatesSet.has(day.date);

              // Visual states
              let bgColor = 'transparent';
              let textColor = colors.textPrimary;
              let borderColor = 'transparent';

              if (!day.isCurrentMonth) {
                textColor = colors.textMuted + '40';
              } else if (isSelected) {
                bgColor = colors.primary;
                textColor = '#FFF';
              } else if (hasAssignment) {
                bgColor = colors.primary + '20';
                if (dayOfWeek === 0) textColor = colors.error;
                else if (dayOfWeek === 6) textColor = colors.info;
              } else {
                if (dayOfWeek === 0) textColor = colors.error;
                else if (dayOfWeek === 6) textColor = colors.info;
              }

              // Today indicator - add border
              if (isToday && day.isCurrentMonth) {
                borderColor = colors.warning;
              }

              return (
                <TouchableOpacity
                  key={`${day.date}-${index}`}
                  style={styles.dayCell}
                  onPress={() => day.isCurrentMonth && toggleDateSelection(day.date)}
                  activeOpacity={day.isCurrentMonth ? 0.6 : 1}
                >
                  <View style={[
                    styles.dayCircle,
                    { backgroundColor: bgColor },
                    isToday && day.isCurrentMonth && {
                      borderWidth: 2,
                      borderColor: borderColor,
                    }
                  ]}>
                    <Text style={[styles.dayText, { color: textColor }]}>{day.day}</Text>
                  </View>
                  {/* Assignment dot */}
                  <View style={styles.dotRow}>
                    {hasAssignment && day.isCurrentMonth && !isSelected && (
                      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={[styles.inlineLegend, { borderTopColor: colors.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary + '30' }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '배정됨' : 'Assigned'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDotToday, { borderColor: colors.warning }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '오늘' : 'Today'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '선택됨' : 'Selected'}
              </Text>
            </View>
          </View>
        </View>

        {/* Selected Dates Panel - Assignments */}
        {selectedDates.size > 0 && (
          <Animated.View style={[
            styles.datePanel,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }],
            }
          ]}>
            <View style={styles.datePanelHeader}>
              <View style={styles.datePanelTitleRow}>
                <Text style={[styles.datePanelTitle, { color: colors.textPrimary }]}>
                  {formatSelectedDatesHeader()}
                </Text>
                {totalSelectedAssignments > 0 && (
                  <View style={[styles.assignmentCountBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.assignmentCountText}>{totalSelectedAssignments}</Text>
                  </View>
                )}
              </View>
              <View style={styles.datePanelActions}>
                {selectedDates.size > 1 && (
                  <TouchableOpacity
                    style={[styles.clearBtn, { backgroundColor: colors.error + '15' }]}
                    onPress={clearSelections}
                  >
                    <Text style={[styles.clearBtnText, { color: colors.error }]}>
                      {language === 'ko' ? '초기화' : 'Clear'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={clearSelections}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Assignments grouped by date */}
            <ScrollView style={styles.assignmentsScrollView} nestedScrollEnabled>
              {selectedDatesAssignments.length > 0 ? (
                selectedDatesAssignments.map(({ date, entries: dateEntries }) => {
                  const dateObj = parseLocalDate(date);
                  const days = ['일', '월', '화', '수', '목', '금', '토'];
                  const isSunday = dateObj.getDay() === 0;

                  return (
                    <View key={date} style={styles.dateGroup}>
                      {/* Date header (only show if multiple dates selected) */}
                      {selectedDates.size > 1 && (
                        <View style={styles.dateGroupHeader}>
                          <View style={[
                            styles.dateGroupBadge,
                            { backgroundColor: isSunday ? colors.error : colors.primary }
                          ]}>
                            <Text style={styles.dateGroupBadgeText}>{dateObj.getDate()}</Text>
                          </View>
                          <Text style={[styles.dateGroupTitle, { color: colors.textSecondary }]}>
                            {dateObj.getMonth() + 1}월 {dateObj.getDate()}일 ({days[dateObj.getDay()]})
                          </Text>
                        </View>
                      )}

                      {/* Assignments for this date */}
                      {dateEntries.map((entry) => (
                        <TouchableOpacity
                          key={entry.id}
                          style={[styles.assignmentRow, { backgroundColor: colors.background }]}
                          onPress={() => {
                            router.push({
                              pathname: '/(main)/team/[teamId]/schedule-view',
                              params: { teamId: entry.team.id }
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.assignmentDot, { backgroundColor: entry.team.color || colors.primary }]} />
                          <View style={styles.assignmentInfo}>
                            <Text style={[styles.assignmentTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                              {entry.title}
                            </Text>
                            {entry.assignment && (
                              <View style={styles.assignmentMeta}>
                                <Text style={styles.roleEmoji}>
                                  {getRoleEmoji(entry.assignment.role.name)}
                                </Text>
                                <Text style={[styles.assignmentRole, { color: colors.textSecondary }]}>
                                  {language === 'ko'
                                    ? entry.assignment.role.name_ko || entry.assignment.role.name
                                    : entry.assignment.role.name}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.assignmentTime, { color: colors.textMuted }]}>
                            {entry.start_time?.slice(0, 5) || '11:00'}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {language === 'ko' ? '배정된 일정이 없습니다' : 'No assignments'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        )}

        {/* Empty State when no assignments this month */}
        {selectedDates.size === 0 && thisMonthAssignmentCount === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="calendar-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyCardTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '이번 달 배정 없음' : 'No assignments this month'}
            </Text>
            <Text style={[styles.emptyCardSubtitle, { color: colors.textMuted }]}>
              {language === 'ko'
                ? '리더가 배정하면 여기에\n예배 일정이 표시됩니다'
                : 'When the leader assigns you,\nyour schedule will appear here'}
            </Text>
            <View style={[styles.emptyHint, { backgroundColor: colors.info + '10', borderColor: colors.info + '30' }]}>
              <Ionicons name="information-circle" size={16} color={colors.info} />
              <Text style={[styles.emptyHintText, { color: colors.info }]}>
                {language === 'ko'
                  ? '출석 가능 여부를 먼저 응답해 주세요'
                  : 'Please respond to availability requests first'}
              </Text>
            </View>
          </View>
        )}

        {/* Summary when not selecting a date */}
        {selectedDates.size === 0 && thisMonthAssignmentCount > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            {/* Header with count badge */}
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="musical-notes" size={20} color={colors.primary} />
              </View>
              <View style={styles.summaryHeaderText}>
                <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '이번 달 배정 일정' : 'My Schedule This Month'}
                </Text>
                <Text style={[styles.summarySubtitle, { color: colors.textSecondary }]}>
                  {language === 'ko'
                    ? `${thisMonthAssignmentCount}개 예배에 배정됨`
                    : `Assigned to ${thisMonthAssignmentCount} service${thisMonthAssignmentCount > 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={[styles.summaryCountBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.summaryCountText}>{thisMonthAssignmentCount}</Text>
              </View>
            </View>

            {/* Schedule List */}
            <View style={styles.summaryList}>
              {/* Group entries by date */}
              {(() => {
                const assignedEntries = entries.filter(e => e.assignment);
                const groupedByDate = new Map<string, typeof assignedEntries>();

                assignedEntries.forEach(entry => {
                  const existing = groupedByDate.get(entry.date) || [];
                  existing.push(entry);
                  groupedByDate.set(entry.date, existing);
                });

                // Convert to array and sort by date
                const sortedDates = Array.from(groupedByDate.entries())
                  .sort(([a], [b]) => a.localeCompare(b));

                return sortedDates.map(([date, dateEntries], index) => {
                  const dateObj = parseLocalDate(date);
                  const isSunday = dateObj.getDay() === 0;
                  const days = language === 'ko'
                    ? ['일', '월', '화', '수', '목', '금', '토']
                    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const isLast = index === sortedDates.length - 1;

                  return (
                    <TouchableOpacity
                      key={date}
                      style={[
                        styles.summaryItem,
                        !isLast && { borderBottomColor: colors.border, borderBottomWidth: 1 }
                      ]}
                      onPress={() => setSelectedDates(new Set([date]))}
                      activeOpacity={0.7}
                    >
                      {/* Date Badge */}
                      <View style={[
                        styles.summaryDateBox,
                        { backgroundColor: isSunday ? colors.error : colors.primary }
                      ]}>
                        <Text style={styles.summaryDateDay}>
                          {dateObj.getDate()}
                        </Text>
                        <Text style={styles.summaryDateWeekday}>
                          {days[dateObj.getDay()]}
                        </Text>
                      </View>

                      {/* Service Info */}
                      <View style={styles.summaryItemInfo}>
                        {dateEntries.map((entry, i) => (
                          <View key={i} style={[
                            styles.summaryServiceRow,
                            i > 0 && { marginTop: spacing.xs }
                          ]}>
                            <Text style={[styles.summaryItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                              {entry.title}
                            </Text>
                            {entry.assignment && (
                              <View style={[styles.roleChip, { backgroundColor: colors.primary + '15' }]}>
                                <Text style={styles.roleEmoji}>
                                  {getRoleEmoji(entry.assignment.role.name)}
                                </Text>
                                <Text style={[styles.roleChipText, { color: colors.primary }]}>
                                  {language === 'ko'
                                    ? entry.assignment.role.name_ko || entry.assignment.role.name
                                    : entry.assignment.role.name}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>

                      {/* Time */}
                      <View style={styles.summaryTimeContainer}>
                        <Text style={[styles.summaryTime, { color: colors.textMuted }]}>
                          {dateEntries[0].start_time?.slice(0, 5) || '11:00'}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>

            {/* Tip */}
            <View style={[styles.summaryTip, { borderTopColor: colors.border }]}>
              <Ionicons name="hand-left-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.summaryTipText, { color: colors.textMuted }]}>
                {language === 'ko'
                  ? '날짜를 탭하면 상세 정보를 볼 수 있어요'
                  : 'Tap a date to see details'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    minWidth: 50,
  },
  todayBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  todayBtnPlaceholder: {
    minWidth: 50,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  monthNavBtn: {
    padding: spacing.xs,
  },
  monthTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    minWidth: 120,
    textAlign: 'center',
  },
  // Scroll
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  // Calendar
  calendarCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  dotRow: {
    flexDirection: 'row',
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // Legend
  inlineLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotToday: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  legendLabel: {
    fontSize: 10,
  },
  // Date Panel
  datePanel: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  datePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  datePanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  datePanelTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  datePanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  clearBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  assignmentCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  assignmentCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  assignmentsScrollView: {
    maxHeight: 300,
  },
  dateGroup: {
    marginBottom: spacing.sm,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  dateGroupBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateGroupBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  dateGroupTitle: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  // Assignments
  assignmentsSection: {
    gap: spacing.xs,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  assignmentDot: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  assignmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  roleEmoji: {
    fontSize: 12,
  },
  assignmentRole: {
    fontSize: fontSize.xs,
  },
  assignmentTime: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
  emptyCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  emptyCardSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  emptyHintText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  // Summary Card
  summaryCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  summaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  summarySubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  summaryCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  summaryCountText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#FFF',
  },
  summaryList: {
    gap: 0,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  summaryDateBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDateDay: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#FFF',
  },
  summaryDateWeekday: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: -2,
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  summaryItemTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 2,
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  summaryTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryTime: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  summaryTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  summaryTipText: {
    fontSize: fontSize.xs,
  },
  summaryItemRole: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  summaryRolesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  summaryItemRoleText: {
    fontSize: fontSize.xs,
    marginLeft: 4,
  },
  bottomSpacer: {
    height: 100,
  },
});
