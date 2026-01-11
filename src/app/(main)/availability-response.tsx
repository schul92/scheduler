/**
 * Availability Response Screen
 *
 * Full calendar view for responding to availability requests.
 * Accessed from Home tab's "응답 대기" section.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeNavigation } from '../../hooks/useNavigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAvailabilityStore, AvailabilityRequest } from '../../store/availabilityStore';
import { useServiceTypeStore } from '../../store/serviceTypeStore';
import { useTeamStore } from '../../store/teamStore';
import { useTheme } from '../../providers/ThemeProvider';
import { useLanguage } from '../../providers/LanguageProvider';
import { setAvailability as saveAvailabilityToSupabase, getAvailability as loadAvailabilityFromSupabase } from '../../lib/api/availability';
import { getTeamServices, ServiceWithStats } from '../../lib/api/services';
import { spacing, borderRadius, fontSize, shadows } from '../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

export default function AvailabilityResponseScreen() {
  const router = useRouter();
  const { safeGoBack } = useSafeNavigation();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  const { activeTeamId } = useTeamStore();
  const { getServiceTypes } = useServiceTypeStore();
  const serviceTypes = getServiceTypes(activeTeamId || '');
  const {
    pendingRequests,
    myAvailability,
    submitAvailability,
    getPendingByDate,
    getPendingCount,
    clearAvailabilityForDates,
  } = useAvailabilityStore();

  const WEEKDAYS = language === 'ko' ? WEEKDAYS_KO : WEEKDAYS_EN;

  // State for services fetched from Supabase
  const [upcomingServices, setUpcomingServices] = useState<ServiceWithStats[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  // Track if data has been loaded to prevent duplicate calls
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Load upcoming services and saved availability from Supabase
  const loadData = useCallback(async (force = false) => {
    if (!activeTeamId) return;
    if (isLoadingRef.current) return; // Prevent concurrent loads
    if (!force && hasLoadedRef.current) return; // Skip if already loaded

    isLoadingRef.current = true;
    setIsLoadingServices(true);

    try {
      // Get date range for current and next month
      const now = new Date();
      const startDate = formatLocalDate(now);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];

      // Fetch upcoming services (these are the dates needing availability)
      const services = await getTeamServices(activeTeamId, {
        startDate,
        endDate,
        includePast: false,
      });
      setUpcomingServices(services);

      // Fetch user's saved availability from Supabase
      const saved = await loadAvailabilityFromSupabase(activeTeamId, startDate, endDate);

      // Create a map of service dates to their update times
      const serviceUpdateTimes = new Map<string, string>();
      services.forEach(s => {
        const serviceTime = (s as any).updated_at || (s as any).created_at || '';
        serviceUpdateTimes.set(s.service_date, serviceTime);
      });

      // Batch sync: collect all updates first, then apply once
      const updates: Array<{ date: string; serviceTypeId: string; status: 'available' | 'unavailable' }> = [];

      saved.forEach(record => {
        const serviceTime = serviceUpdateTimes.get(record.date);
        if (!serviceTime) return;

        const availUpdatedAt = record.updated_at;
        if (availUpdatedAt && serviceTime && availUpdatedAt > serviceTime) {
          const dayOfWeek = parseLocalDate(record.date).getDay();
          const matchingServiceType = serviceTypes.find(st => st.defaultDay === dayOfWeek);
          if (matchingServiceType) {
            updates.push({
              date: record.date,
              serviceTypeId: matchingServiceType.id,
              status: record.is_available ? 'available' : 'unavailable'
            });
          }
        }
      });

      // Apply updates outside of this callback to avoid re-render loop
      if (updates.length > 0) {
        // Use setTimeout to break the render cycle
        setTimeout(() => {
          updates.forEach(u => submitAvailability(u.date, u.serviceTypeId, u.status));
        }, 0);
      }

      hasLoadedRef.current = true;
      console.log('[Availability] Loaded', services.length, 'services');
    } catch (error) {
      console.error('[Availability] Failed to load from Supabase:', error);
    } finally {
      setIsLoadingServices(false);
      isLoadingRef.current = false;
    }
  }, [activeTeamId, serviceTypes]); // Removed store functions from deps

  // Load on mount only
  useEffect(() => {
    loadData();
  }, [activeTeamId]); // Only depend on activeTeamId

  // Refetch when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Force refresh when returning to screen
      if (hasLoadedRef.current) {
        loadData(true);
      }
    }, [activeTeamId]) // Minimal deps
  );

  // Get pending requests grouped by date
  const pendingByDate = useMemo(() => getPendingByDate(), [pendingRequests]);

  // Deduplicated services - remove duplicates by date + service type name
  const uniqueServices = useMemo(() => {
    const seen = new Set<string>();
    return upcomingServices.filter(service => {
      const parts = service.name.split(' ');
      const serviceTypeName = parts.slice(1).join(' ') || service.name;
      const key = `${service.service_date}:${serviceTypeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [upcomingServices]);

  // Get requested dates from Supabase services (these are the dates needing response)
  const requestedDatesSet = useMemo(() => {
    // Combine local pending requests with deduplicated services
    const dates = new Set(Object.keys(pendingByDate));
    uniqueServices.forEach(service => {
      // Only add dates where user hasn't responded yet
      const hasResponse = Object.values(myAvailability).some(
        a => a.date === service.service_date
      );
      if (!hasResponse) {
        dates.add(service.service_date);
      }
    });
    return dates;
  }, [pendingByDate, uniqueServices, myAvailability]);

  // Animate panel when date selected
  useEffect(() => {
    if (selectedDate) {
      slideAnim.setValue(20);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  }, [selectedDate]);

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

  // Show completion toast
  const showToast = () => {
    setShowCompletionToast(true);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setShowCompletionToast(false);
      // Navigate back to home when all done
      safeGoBack();
    });
  };

  // Quick response for a specific service - saves to both local store and Supabase
  const handleServiceResponse = async (date: string, serviceTypeId: string, status: 'available' | 'unavailable') => {
    // Update local store immediately for responsive UI
    submitAvailability(date, serviceTypeId, status);

    // Save to Supabase for persistence
    if (activeTeamId) {
      try {
        await saveAvailabilityToSupabase(activeTeamId, date, status === 'available');
        console.log('[Availability] Saved to Supabase:', date, status);
      } catch (error) {
        console.error('[Availability] Failed to save to Supabase:', error);
        // Note: Local store is already updated, so UI remains responsive
        // In production, you might want to show an error toast here
      }
    }

    // Check if all services responded
    const remainingCount = getPendingCount();
    if (remainingCount === 0) {
      setTimeout(() => {
        setSelectedDate(null);
        showToast();
      }, 150);
    }
  };

  // Go to today
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(today);
  };

  // Helper: Check if a service type matches the day of week
  const serviceMatchesDay = (serviceTypeId: string, dateStr: string) => {
    // Ad-hoc services (from Supabase) always match their date
    if (serviceTypeId.startsWith('adhoc-')) return true;

    const dayOfWeek = parseLocalDate(dateStr).getDay();
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    // Use strict equality - undefined defaultDay means no default day configured
    return serviceType?.defaultDay === dayOfWeek;
  };

  // Helper: Get ad-hoc services for a date (truly custom services, not misconfigured regular services)
  const getAdhocServicesForDate = (dateStr: string) => {
    const dayOfWeek = parseLocalDate(dateStr).getDay();

    // Get service type names configured for THIS day
    const typeNamesForThisDay = serviceTypes
      .filter(st => st.defaultDay === dayOfWeek)
      .map(st => st.name);

    // Get ALL service type names (to detect misconfigured services)
    const allServiceTypeNames = serviceTypes.map(st => st.name);

    // Find truly ad-hoc services (use deduplicated list)
    return uniqueServices.filter(service => {
      if (service.service_date !== dateStr) return false;

      // Extract service type name from the service name (format: "M/D ServiceTypeName")
      const parts = service.name.split(' ');
      const serviceTypeName = parts.slice(1).join(' ') || service.name;

      // If service name matches a service type configured for THIS day, it's a regular service (not ad-hoc)
      if (typeNamesForThisDay.includes(serviceTypeName)) {
        return false;
      }

      // If service name matches ANY other service type (wrong day), it's likely a bug - exclude it
      if (allServiceTypeNames.includes(serviceTypeName)) {
        return false;
      }

      // Truly ad-hoc: name doesn't match any configured service type
      return true;
    });
  };

  // Filtered pending requests for selected date
  const filteredPendingForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const allPending = pendingByDate[selectedDate] || [];
    return allPending.filter(req => serviceMatchesDay(req.serviceTypeId, selectedDate));
  }, [selectedDate, pendingByDate, serviceTypes]);

  // Get valid service dates (dates that have current services) - use deduplicated
  const validServiceDates = useMemo(() => {
    return new Set(uniqueServices.map(s => s.service_date));
  }, [uniqueServices]);

  // Get date availability status
  const getDateStatus = (dateStr: string) => {
    // Check if this date has a service
    const hasService = validServiceDates.has(dateStr);

    // Get service types for this day (strict equality - undefined means no default day)
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    const matchingServiceTypes = serviceTypes.filter(
      st => st.defaultDay === dayOfWeek
    );

    // Also count ad-hoc services for this date (use deduplicated)
    const adhocServices = uniqueServices.filter(s => {
      if (s.service_date !== dateStr) return false;
      const parts = s.name.split(' ');
      const serviceTypeName = parts.slice(1).join(' ') || s.name;
      return !matchingServiceTypes.some(st => st.name === serviceTypeName);
    });

    const totalServicesForDate = matchingServiceTypes.length + adhocServices.length;

    let availableCount = 0;
    let unavailableCount = 0;

    // Count responses for this date
    Object.entries(myAvailability).forEach(([key, avail]) => {
      if (avail.date === dateStr && hasService) {
        // Check if this is for a matching service type or an ad-hoc service
        const isMatchingService = matchingServiceTypes.some(st => st.id === avail.serviceTypeId);
        const isAdhocService = avail.serviceTypeId.startsWith('adhoc-');
        if (isMatchingService || isAdhocService) {
          if (avail.status === 'available') availableCount++;
          if (avail.status === 'unavailable') unavailableCount++;
        }
      }
    });

    const totalResponded = availableCount + unavailableCount;
    const hasAvailable = availableCount > 0;
    const hasUnavailable = unavailableCount > 0;

    // A date is "in progress" if some (but not all) services are answered
    const isInProgress = hasService && totalServicesForDate > 0 && totalResponded > 0 && totalResponded < totalServicesForDate;

    // A date is pending if it has services but no responses at all
    const isPending = hasService && totalServicesForDate > 0 && totalResponded === 0;

    // A date is complete if all services are answered
    const isComplete = hasService && totalServicesForDate > 0 && totalResponded >= totalServicesForDate;

    return { hasPending: isPending, hasAvailable, hasUnavailable, isInProgress, isComplete };
  };

  // Format helpers
  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const date = parseLocalDate(selectedDate);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    if (language === 'ko') {
      return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const formatMonthYear = () => {
    if (language === 'ko') {
      return `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
    }
    return currentMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Calculate response stats using deduplicated services
  const responseStats = useMemo(() => {
    // Total = unique services (deduplicated)
    const totalRequested = uniqueServices.length;

    // Count responses for each service
    let responded = 0;
    let available = 0;
    let unavailable = 0;

    // For each unique service, check if user has responded
    uniqueServices.forEach(service => {
      const dateStr = service.service_date;

      // Extract service type name from service name (format: "M/D ServiceTypeName")
      const parts = service.name.split(' ');
      const serviceTypeName = parts.slice(1).join(' ') || service.name;

      // Find matching service type
      const matchingType = serviceTypes.find(st => st.name === serviceTypeName);

      // Check if user has responded to this specific service
      const response = Object.values(myAvailability).find(a => {
        if (a.date !== dateStr) return false;

        if (matchingType) {
          // Regular service - match by service type ID
          return a.serviceTypeId === matchingType.id;
        } else {
          // Ad-hoc service - match by exact service ID (adhoc-{supabase-service-id})
          // This ensures each ad-hoc service is counted individually
          return a.serviceTypeId === `adhoc-${service.id}`;
        }
      });

      if (response) {
        responded++;
        if (response.status === 'available') available++;
        if (response.status === 'unavailable') unavailable++;
      }
    });

    const pending = totalRequested - responded;
    return { totalRequested, responded, available, unavailable, pending };
  }, [uniqueServices, myAvailability, serviceTypes]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => safeGoBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '내 가능여부' : 'My Availability'}
          </Text>
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
            <View style={styles.headerSpacer} />
          )}
        </View>

        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            style={styles.monthNavBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>{formatMonthYear()}</Text>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            style={styles.monthNavBtn}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Card */}
        {responseStats.totalRequested > 0 && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface }]}>
            <View style={styles.progressHeader}>
              <Ionicons name="stats-chart" size={18} color={colors.primary} />
              <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '응답 현황' : 'Response Progress'}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${responseStats.totalRequested > 0 ? (responseStats.responded / responseStats.totalRequested) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textPrimary }]}>
              {responseStats.responded}/{responseStats.totalRequested} {language === 'ko' ? '완료' : 'done'}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  {responseStats.available}
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  {responseStats.unavailable}
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: colors.textMuted, opacity: 0.5 }]} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  {responseStats.pending} {language === 'ko' ? '대기' : 'pending'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Calendar Grid */}
        <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}>
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
              const isSelected = day.date === selectedDate;
              const dayOfWeek = index % 7;
              const hasService = validServiceDates.has(day.date);
              const isSelectable = day.isCurrentMonth && hasService;

              const { hasPending, hasAvailable, hasUnavailable, isInProgress, isComplete } = getDateStatus(day.date);

              // Visual states
              let bgColor = 'transparent';
              let borderColor = 'transparent';
              let textColor = colors.textPrimary;
              let borderWidth = 0;
              let showInProgressIndicator = false;
              let showTodayRing = false;

              if (!day.isCurrentMonth) {
                textColor = colors.textMuted + '40';
              } else if (isSelected) {
                bgColor = colors.primary;
                textColor = '#FFF';
              } else if (isInProgress) {
                // In progress: show warning/orange color with indicator
                bgColor = colors.warning;
                textColor = '#FFF';
                showInProgressIndicator = true;
                if (isToday) showTodayRing = true;
              } else if (hasPending) {
                bgColor = colors.primary + '20';
                borderColor = colors.primary;
                borderWidth = 2;
                textColor = colors.primary;
                if (isToday) showTodayRing = true;
              } else if (isComplete && hasAvailable && !hasUnavailable) {
                // All answered as available
                bgColor = colors.success;
                textColor = '#FFF';
                if (isToday) showTodayRing = true;
              } else if (isComplete && hasUnavailable && !hasAvailable) {
                // All answered as unavailable
                bgColor = colors.error;
                textColor = '#FFF';
                if (isToday) showTodayRing = true;
              } else if (isComplete && hasAvailable && hasUnavailable) {
                // All answered with mixed responses
                bgColor = colors.warning + '80';
                textColor = '#FFF';
                if (isToday) showTodayRing = true;
              } else if (isToday) {
                // Today without service - just show outline
                borderColor = colors.textMuted;
                borderWidth = 1;
                if (dayOfWeek === 0) textColor = colors.error;
                else if (dayOfWeek === 6) textColor = colors.info;
              } else {
                // Regular day without service
                if (dayOfWeek === 0) textColor = colors.error;
                else if (dayOfWeek === 6) textColor = colors.info;
                else textColor = colors.textMuted;
              }

              return (
                <TouchableOpacity
                  key={`${day.date}-${index}`}
                  style={styles.dayCell}
                  onPress={() => isSelectable && setSelectedDate(day.date)}
                  activeOpacity={isSelectable ? 0.6 : 1}
                  disabled={!isSelectable}
                >
                  <View style={styles.dayCircleWrapper}>
                    {showTodayRing && (
                      <View style={[styles.todayRing, { borderColor: colors.textPrimary }]} />
                    )}
                    <View style={[
                      styles.dayCircle,
                      { backgroundColor: bgColor, borderColor, borderWidth },
                    ]}>
                      <Text style={[styles.dayText, { color: textColor }]}>{day.day}</Text>
                      {showInProgressIndicator && (
                        <View style={[styles.inProgressDot, { backgroundColor: '#FFF' }]} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={[styles.inlineLegend, { borderTopColor: colors.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDotWrapper]}>
                <View style={[styles.legendTodayRing, { borderColor: colors.textPrimary }]} />
              </View>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '오늘' : 'Today'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primary + '20' }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '대기' : 'Pending'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]}>
                <View style={styles.legendInProgressDot} />
              </View>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '진행중' : 'In Progress'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '완료' : 'Done'}
              </Text>
            </View>
          </View>
        </View>

        {/* Selected Date Panel */}
        {selectedDate && (
          <Animated.View style={[
            styles.datePanel,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }],
            }
          ]}>
            <View style={styles.datePanelHeader}>
              <Text style={[styles.datePanelTitle, { color: colors.textPrimary }]}>
                {formatSelectedDate()}
              </Text>
              <TouchableOpacity onPress={() => setSelectedDate(null)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Per-Service Response Section */}
            {(() => {
              if (!selectedDate) return null;

              const dayOfWeek = parseLocalDate(selectedDate).getDay();
              const matchingServiceTypes = serviceTypes
                .filter(st => st.defaultDay === dayOfWeek)
                .sort((a, b) => (a.serviceTime || '').localeCompare(b.serviceTime || ''));

              // Get ad-hoc services for this date
              const adhocServices = getAdhocServicesForDate(selectedDate);

              if (matchingServiceTypes.length === 0 && adhocServices.length === 0) return null;

              return (
                <View style={styles.servicesSection}>
                  {/* Regular service types */}
                  {matchingServiceTypes.map((serviceType) => {
                    const isPending = filteredPendingForSelectedDate.some(
                      req => req.serviceTypeId === serviceType.id
                    );
                    const availability = Object.values(myAvailability).find(
                      avail => avail.date === selectedDate && avail.serviceTypeId === serviceType.id
                    );

                    const pendingRequest = filteredPendingForSelectedDate.find(
                      req => req.serviceTypeId === serviceType.id
                    );
                    const serviceName = serviceType.name || pendingRequest?.serviceTypeName || serviceType.id;
                    const serviceTime = serviceType.serviceTime || pendingRequest?.serviceTime;

                    if (isPending) {
                      return (
                        <View
                          key={serviceType.id}
                          style={[styles.serviceRow, { borderBottomColor: colors.border }]}
                        >
                          <View style={styles.serviceInfo}>
                            <Text style={[styles.serviceName, { color: colors.textPrimary }]}>
                              {serviceName}
                            </Text>
                            {serviceTime && (
                              <Text style={[styles.serviceTime, { color: colors.textMuted }]}>
                                {serviceTime}
                              </Text>
                            )}
                          </View>
                          <View style={styles.serviceResponseButtons}>
                            <TouchableOpacity
                              style={[styles.serviceResponseBtn, { backgroundColor: colors.success }]}
                              onPress={() => handleServiceResponse(selectedDate, serviceType.id, 'available')}
                            >
                              <Ionicons name="checkmark" size={18} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.serviceResponseBtn, { backgroundColor: colors.error }]}
                              onPress={() => handleServiceResponse(selectedDate, serviceType.id, 'unavailable')}
                            >
                              <Ionicons name="close" size={18} color="#FFF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    } else if (availability) {
                      return (
                        <View
                          key={serviceType.id}
                          style={[styles.serviceRow, styles.respondedServiceRow, { borderBottomColor: colors.border }]}
                        >
                          <View style={styles.serviceInfo}>
                            <Text style={[styles.serviceName, { color: colors.textPrimary }]}>
                              {serviceName}
                            </Text>
                            {serviceTime && (
                              <Text style={[styles.serviceTime, { color: colors.textMuted }]}>
                                {serviceTime}
                              </Text>
                            )}
                          </View>
                          <View style={styles.serviceStatusRow}>
                            <View style={[
                              styles.serviceStatusChip,
                              {
                                backgroundColor: availability.status === 'available'
                                  ? colors.success + '15'
                                  : colors.error + '15'
                              }
                            ]}>
                              <Ionicons
                                name={availability.status === 'available' ? 'checkmark-circle' : 'close-circle'}
                                size={14}
                                color={availability.status === 'available' ? colors.success : colors.error}
                              />
                              <Text style={[
                                styles.serviceStatusText,
                                { color: availability.status === 'available' ? colors.success : colors.error }
                              ]}>
                                {availability.status === 'available'
                                  ? (language === 'ko' ? '가능' : 'Yes')
                                  : (language === 'ko' ? '불가' : 'No')}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.changeBtn, { borderColor: colors.border }]}
                              onPress={() => handleServiceResponse(
                                selectedDate,
                                serviceType.id,
                                availability.status === 'available' ? 'unavailable' : 'available'
                              )}
                            >
                              <Text style={[styles.changeBtnText, { color: colors.textMuted }]}>
                                {language === 'ko' ? '변경' : 'Change'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }
                    return null;
                  })}

                  {/* Ad-hoc services from Supabase */}
                  {adhocServices.map((service, index) => {
                    // Use adhoc-{service.id} as the serviceTypeId for tracking
                    const adhocServiceTypeId = `adhoc-${service.id}`;
                    const availability = Object.values(myAvailability).find(
                      avail => avail.date === selectedDate && avail.serviceTypeId === adhocServiceTypeId
                    );

                    // Extract display name from service name (format: "M/D ServiceTypeName")
                    const parts = service.name.split(' ');
                    const serviceName = parts.slice(1).join(' ') || service.name;
                    const serviceTime = service.start_time;

                    if (!availability) {
                      // Pending - show response buttons
                      return (
                        <View
                          key={service.id}
                          style={[styles.serviceRow, { borderBottomColor: colors.border }]}
                        >
                          <View style={styles.serviceInfo}>
                            <Text style={[styles.serviceName, { color: colors.textPrimary }]}>
                              {serviceName}
                            </Text>
                            {serviceTime && (
                              <Text style={[styles.serviceTime, { color: colors.textMuted }]}>
                                {serviceTime}
                              </Text>
                            )}
                          </View>
                          <View style={styles.serviceResponseButtons}>
                            <TouchableOpacity
                              style={[styles.serviceResponseBtn, { backgroundColor: colors.success }]}
                              onPress={() => handleServiceResponse(selectedDate, adhocServiceTypeId, 'available')}
                            >
                              <Ionicons name="checkmark" size={18} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.serviceResponseBtn, { backgroundColor: colors.error }]}
                              onPress={() => handleServiceResponse(selectedDate, adhocServiceTypeId, 'unavailable')}
                            >
                              <Ionicons name="close" size={18} color="#FFF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    } else {
                      // Already responded - show status with change button
                      return (
                        <View
                          key={service.id}
                          style={[styles.serviceRow, styles.respondedServiceRow, { borderBottomColor: colors.border }]}
                        >
                          <View style={styles.serviceInfo}>
                            <Text style={[styles.serviceName, { color: colors.textPrimary }]}>
                              {serviceName}
                            </Text>
                            {serviceTime && (
                              <Text style={[styles.serviceTime, { color: colors.textMuted }]}>
                                {serviceTime}
                              </Text>
                            )}
                          </View>
                          <View style={styles.serviceStatusRow}>
                            <View style={[
                              styles.serviceStatusChip,
                              {
                                backgroundColor: availability.status === 'available'
                                  ? colors.success + '15'
                                  : colors.error + '15'
                              }
                            ]}>
                              <Ionicons
                                name={availability.status === 'available' ? 'checkmark-circle' : 'close-circle'}
                                size={14}
                                color={availability.status === 'available' ? colors.success : colors.error}
                              />
                              <Text style={[
                                styles.serviceStatusText,
                                { color: availability.status === 'available' ? colors.success : colors.error }
                              ]}>
                                {availability.status === 'available'
                                  ? (language === 'ko' ? '가능' : 'Yes')
                                  : (language === 'ko' ? '불가' : 'No')}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.changeBtn, { borderColor: colors.border }]}
                              onPress={() => handleServiceResponse(
                                selectedDate,
                                adhocServiceTypeId,
                                availability.status === 'available' ? 'unavailable' : 'available'
                              )}
                            >
                              <Text style={[styles.changeBtnText, { color: colors.textMuted }]}>
                                {language === 'ko' ? '변경' : 'Change'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }
                  })}
                </View>
              );
            })()}

            {/* Empty state - check both regular and ad-hoc services */}
            {(() => {
              if (!selectedDate) return null;

              const dayOfWeek = parseLocalDate(selectedDate).getDay();
              const matchingServiceTypes = serviceTypes.filter(
                st => st.defaultDay === dayOfWeek
              );
              const adhocServices = getAdhocServicesForDate(selectedDate);

              // Show empty state only if there are no services at all for this date
              const hasServices = matchingServiceTypes.length > 0 || adhocServices.length > 0;
              const hasResponses = Object.entries(myAvailability).some(([_, a]) =>
                a.date === selectedDate && serviceMatchesDay(a.serviceTypeId, selectedDate)
              );

              if (!hasServices && filteredPendingForSelectedDate.length === 0 && !hasResponses) {
                return (
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      {language === 'ko' ? '응답할 예배가 없습니다' : 'No services to respond'}
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
          </Animated.View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Completion Toast */}
      {showCompletionToast && (
        <Animated.View
          style={[
            styles.completionToast,
            {
              backgroundColor: colors.success,
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          <Text style={styles.completionToastText}>
            {language === 'ko' ? '모든 응답 완료!' : 'All done!'}
          </Text>
        </Animated.View>
      )}
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  todayBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
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
  // Progress Card
  progressCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: fontSize.xs,
  },
  // Calendar
  calendarCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.sm,
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
  dayCircleWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
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
  inProgressDot: {
    position: 'absolute',
    bottom: 3,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  // Legend
  inlineLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDotWrapper: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendTodayRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendInProgressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF',
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
  datePanelTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  // Services Section
  servicesSection: {
    marginBottom: spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  respondedServiceRow: {
    opacity: 0.8,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  serviceTime: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  serviceResponseButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  serviceResponseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  serviceStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  serviceStatusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  changeBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  changeBtnText: {
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
  bottomSpacer: {
    height: 100,
  },
  // Completion Toast
  completionToast: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  completionToastText: {
    color: '#FFF',
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});
