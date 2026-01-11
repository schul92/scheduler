/**
 * Home Tab Screen - Leader Dashboard
 *
 * Redesigned with scheduling at top, modern UX
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '../../../store/teamStore';
import { useUpcomingServices, useTeamServices } from '../../../hooks/usePersonalCalendar';
import { usePermissions } from '../../../hooks/usePermissions';
import { useConflictStore } from '../../../store/conflictStore';
import { useSchedulingStore } from '../../../store/schedulingStore';
import { useServiceTypeStore } from '../../../store/serviceTypeStore';
import { useAvailabilityStore } from '../../../store/availabilityStore';
import { getCurrentUser, supabase } from '../../../lib/supabase';
import { getAvailability } from '../../../lib/api/availability';
import { getServiceById } from '../../../lib/api/services';
import { useTheme } from '../../../providers/ThemeProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { spacing, borderRadius, fontSize, shadows, lightColors } from '../../../lib/theme';

const staticColors = lightColors;

// Helper to parse YYYY-MM-DD string as local date (avoids UTC parsing issues)
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { language, t } = useLanguage();
  const { activeTeam, activeTeamId } = useTeamStore();
  const team = activeTeam();
  const { services } = useUpcomingServices(5);
  // Fetch more services for calendar view (up to 31 for a month)
  const { services: teamServices, isLoading: teamServicesLoading, refetch: refetchTeamServices } = useTeamServices(activeTeamId, 31);

  // Refetch team services when screen is focused (e.g., returning from team assignment)
  useFocusEffect(
    useCallback(() => {
      refetchTeamServices();
      // Clear detailed services cache to force refetch
      setDetailedServicesMap(new Map());
    }, [refetchTeamServices])
  );

  // Selected date state for calendar
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Store detailed service info with accurate assignment counts (fetched individually)
  const [detailedServicesMap, setDetailedServicesMap] = useState<Map<string, { assignment_count: number; confirmed_count: number }>>(new Map());

  // Fetch detailed service info for selected date services
  useEffect(() => {
    const fetchDetailedServices = async () => {
      if (!selectedDate || !teamServices.length) return;

      const servicesForDate = teamServices.filter(s => s.service_date === selectedDate);
      if (servicesForDate.length === 0) return;

      const newMap = new Map(detailedServicesMap);
      let hasChanges = false;

      for (const service of servicesForDate) {
        // Skip if already fetched
        if (newMap.has(service.id)) continue;

        try {
          const detailed = await getServiceById(service.id);
          const assignmentCount = detailed.assignments?.length || 0;
          const confirmedCount = detailed.assignments?.filter(a => a.status === 'confirmed').length || 0;
          newMap.set(service.id, { assignment_count: assignmentCount, confirmed_count: confirmedCount });
          hasChanges = true;
        } catch (err) {
          console.error('Failed to fetch service details:', err);
        }
      }

      if (hasChanges) {
        setDetailedServicesMap(newMap);
      }
    };

    fetchDetailedServices();
  }, [selectedDate, teamServices]);

  const { isAdmin, isOwner } = usePermissions(activeTeamId ?? undefined);
  const isLeader = isAdmin || isOwner;
  const { getUnresolvedConflicts } = useConflictStore();
  const unresolvedConflicts = getUnresolvedConflicts();
  const { selectedDates, schedules, isConfirmed } = useSchedulingStore();
  const { pendingRequests, myAvailability } = useAvailabilityStore();
  const { getServiceTypes } = useServiceTypeStore();
  const serviceTypes = getServiceTypes(team?.id || '');

  const [userName, setUserName] = useState<string>('');
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    setIsLoadingUser(true);
    getCurrentUser().then((user) => {
      if (user?.full_name) {
        setUserName(user.full_name);
      }
    }).finally(() => {
      setIsLoadingUser(false);
    });
  }, []);

  // Fetch and sync availability from Supabase
  const fetchAndSyncAvailability = useCallback(async () => {
    if (!activeTeamId || !team?.id) return;

    try {
      // Get date range for current month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0]; // Next 2 months

      // Fetch user's availability from Supabase
      const availabilityRecords = await getAvailability(activeTeamId, startDate, endDate);

      // Get scheduled service dates (draft services = availability requests)
      const { data: draftServices } = await supabase
        .from('services')
        .select('id, service_date, name, start_time')
        .eq('team_id', activeTeamId)
        .eq('status', 'draft')
        .gte('service_date', startDate)
        .lte('service_date', endDate);

      // Build set of dates user has responded to
      const respondedDates = new Set(availabilityRecords.map(r => r.date));

      // Convert availability records to store format
      const { submitAvailability, addRequests } = useAvailabilityStore.getState();

      // Sync existing availability responses to store
      // Extract service type from name (format: "M/D ServiceTypeName")
      const getServiceTypeFromName = (serviceName: string) => {
        const parts = serviceName.split(' ');
        const serviceTypeName = parts.slice(1).join(' ') || serviceName;
        const matchingType = serviceTypes.find(st => st.name === serviceTypeName);
        return matchingType?.id || 'default';
      };

      availabilityRecords.forEach(record => {
        const serviceForDate = draftServices?.find(s => s.service_date === record.date);
        if (serviceForDate) {
          submitAvailability(
            record.date,
            getServiceTypeFromName(serviceForDate.name),
            record.is_available ? 'available' : 'unavailable',
            record.reason || undefined
          );
        }
      });

      // Find pending requests (draft services user hasn't responded to)
      const pendingServiceDates = (draftServices || []).filter(
        s => !respondedDates.has(s.service_date)
      );

      // Get service types for building proper pending requests
      const teamServiceTypes = serviceTypes.length > 0 ? serviceTypes : [{ id: 'default', name: '예배', serviceTime: '11:00' }];

      const pendingRequestsToAdd = pendingServiceDates.map(s => {
        // Extract service type name from service name (format: "M/D ServiceTypeName")
        const parts = s.name.split(' ');
        const serviceTypeName = parts.slice(1).join(' ') || s.name;
        const serviceType = teamServiceTypes.find(st => st.name === serviceTypeName) || teamServiceTypes[0];
        return {
          date: s.service_date,
          serviceTypeId: serviceType?.id || 'default',
          serviceTypeName: serviceType?.name || serviceTypeName,
          serviceTime: serviceType?.serviceTime || s.start_time,
          teamId: activeTeamId,
          deadline: null,
          requestedAt: new Date().toISOString(),
        };
      });

      if (pendingRequestsToAdd.length > 0) {
        addRequests(pendingRequestsToAdd);
      }
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    }
  }, [activeTeamId, team?.id, serviceTypes]);

  // Fetch availability on mount AND when screen is focused (returning from other screens or login)
  useFocusEffect(
    useCallback(() => {
      fetchAndSyncAvailability();
    }, [fetchAndSyncAvailability])
  );

  // Note: Service types should be created by the leader during onboarding
  // (service-setup screen), not auto-initialized here

  const today = new Date();
  const formattedDate = today.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  // Total alerts count (only conflicts - pending availability is handled by alerts screen from Supabase)
  const totalAlerts = unresolvedConflicts.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Welcome Header */}
        <View style={[styles.welcomeHeader, { backgroundColor: colors.surface }]}>
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeLeft}>
              {isLoadingUser ? (
                <View style={styles.userNameLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <Text style={[styles.welcomeName, { color: colors.textPrimary }]}>
                  {language === 'ko' ? `${userName || '회원'}님` : userName || 'Member'}
                </Text>
              )}
              {isLeader && !isLoadingUser && (
                <View style={[styles.leaderBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="star" size={10} color={colors.primary} />
                  <Text style={[styles.leaderBadgeText, { color: colors.primary }]}>
                    Leader
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.dateBadge, { backgroundColor: colors.background }]}>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formattedDate}</Text>
              </View>
              {isLeader && (
                <TouchableOpacity
                  style={[styles.settingsBtn, { backgroundColor: colors.background }]}
                  onPress={() => router.push(`/(main)/team/${team?.id}/settings`)}
                >
                  <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* SCHEDULING SECTION - TOP PRIORITY FOR LEADERS */}
        {isLeader && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '스케줄 관리' : 'Schedule'}
              </Text>
            </View>

            {/* Modern Hero Cards */}
            <View style={styles.scheduleHeroRow}>
              {/* Set Dates Card - Green when confirmed */}
              <TouchableOpacity
                style={[
                  styles.scheduleHeroCard,
                  {
                    backgroundColor: isConfirmed
                      ? (isDark ? colors.success + '20' : colors.success)
                      : (isDark ? colors.primary + '25' : colors.primary)
                  },
                  isDark && {
                    borderWidth: 1,
                    borderColor: isConfirmed ? colors.success + '40' : colors.primary + '40'
                  },
                ]}
                onPress={() => router.push(`/(main)/team/${team?.id}/set-dates`)}
                activeOpacity={0.85}
              >
                <View style={styles.heroIconWrapper}>
                  <Ionicons
                    name={isConfirmed ? "checkmark-circle" : "calendar"}
                    size={28}
                    color={isDark
                      ? (isConfirmed ? colors.success : colors.primary)
                      : 'rgba(255,255,255,0.9)'}
                  />
                </View>
                <Text style={[styles.heroTitle, isDark && { color: colors.textPrimary }]}>
                  {language === 'ko' ? '날짜 설정' : 'Set Dates'}
                </Text>
                <Text style={[styles.heroSub, isDark && { color: colors.textSecondary }]}>
                  {isConfirmed
                    ? (language === 'ko' ? '완료됨' : 'Confirmed')
                    : (language === 'ko' ? '예배일 선택' : 'Select dates')}
                </Text>
                <View style={[
                  styles.heroStep,
                  isDark && { backgroundColor: isConfirmed ? colors.success + '30' : colors.primary + '30' }
                ]}>
                  <Text style={[
                    styles.heroStepText,
                    isDark && { color: isConfirmed ? colors.success : colors.primary }
                  ]}>
                    {isConfirmed ? '✓' : '1'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Overview & Assign Card */}
              {(() => {
                let totalServices = 0;
                selectedDates.forEach(date => {
                  const dayOfWeek = parseLocalDate(date).getDay();
                  const matchingTypes = serviceTypes.filter(t => t.defaultDay === dayOfWeek);
                  totalServices += matchingTypes.length > 0 ? matchingTypes.length : 1;
                });

                const assignedServices = Object.values(schedules).filter(s =>
                  s.assignments && Object.keys(s.assignments).length > 0
                ).length;

                const isInProgress = assignedServices > 0 && assignedServices < totalServices;
                const isComplete = totalServices > 0 && assignedServices >= totalServices;
                const assignmentColor = isComplete ? colors.success : isInProgress ? colors.warning : colors.info;
                const statusText = isComplete
                  ? (language === 'ko' ? '완료됨' : 'Complete')
                  : isInProgress
                    ? (language === 'ko' ? `진행중 ${assignedServices}/${totalServices}` : `${assignedServices}/${totalServices}`)
                    : (language === 'ko' ? '시작 전' : 'Not Started');
                const statusIcon = isComplete ? 'checkmark-circle' : isInProgress ? 'time' : 'people';
                const stepText = isComplete ? '✓' : '2';

                return (
                  <TouchableOpacity
                    style={[
                      styles.scheduleHeroCard,
                      { backgroundColor: isDark ? assignmentColor + '20' : assignmentColor },
                      isDark && { borderWidth: 1, borderColor: assignmentColor + '40' },
                    ]}
                    onPress={() => router.push(`/(main)/team/${team?.id}/dates-overview`)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.heroIconWrapper}>
                      <Ionicons
                        name={statusIcon}
                        size={28}
                        color={isDark ? assignmentColor : 'rgba(255,255,255,0.9)'}
                      />
                    </View>
                    <Text style={[styles.heroTitle, isDark && { color: colors.textPrimary }]}>
                      {language === 'ko' ? '팀 배정' : 'Assign Team'}
                    </Text>
                    <Text style={[styles.heroSub, isDark && { color: colors.textSecondary }]}>
                      {statusText}
                    </Text>
                    <View style={[styles.heroStep, isDark && { backgroundColor: assignmentColor + '30' }]}>
                      <Text style={[styles.heroStepText, isDark && { color: assignmentColor }]}>
                        {stepText}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        )}

        {/* MY AVAILABILITY CARD */}
        {(() => {
          const totalRequested = pendingRequests.length + Object.keys(myAvailability).length;
          const respondedCount = Object.keys(myAvailability).length;
          const availableCount = Object.values(myAvailability).filter(a => a.status === 'available').length;
          const unavailableCount = Object.values(myAvailability).filter(a => a.status === 'unavailable').length;
          const isComplete = pendingRequests.length === 0 && totalRequested > 0;
          const progressPercent = totalRequested > 0 ? (respondedCount / totalRequested) * 100 : 0;

          return (
            <TouchableOpacity
              style={[styles.availabilityCardNew, { backgroundColor: colors.surface }]}
              onPress={() => router.push('/(main)/availability-response')}
              activeOpacity={0.7}
            >
              {/* Header Row */}
              <View style={styles.availabilityHeader}>
                <View style={styles.availabilityHeaderLeft}>
                  <Text style={[styles.availabilityTitleNew, { color: colors.textPrimary }]}>
                    {language === 'ko' ? '내 가능 여부' : 'My Availability'}
                  </Text>
                  {totalRequested > 0 && (
                    <View style={[
                      styles.availabilityBadge,
                      { backgroundColor: isComplete ? colors.success + '15' : colors.warning + '15' }
                    ]}>
                      <Ionicons
                        name={isComplete ? 'checkmark-circle' : 'time'}
                        size={12}
                        color={isComplete ? colors.success : colors.warning}
                      />
                      <Text style={[
                        styles.availabilityBadgeText,
                        { color: isComplete ? colors.success : colors.warning }
                      ]}>
                        {isComplete
                          ? (language === 'ko' ? '완료' : 'Done')
                          : (language === 'ko' ? `${pendingRequests.length}개 대기` : `${pendingRequests.length} pending`)}
                      </Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>

              {/* Progress Section */}
              {totalRequested > 0 ? (
                <View style={styles.availabilityProgress}>
                  <View style={styles.availabilityProgressRow}>
                    <View style={[styles.availabilityProgressBar, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.availabilityProgressFill,
                          {
                            backgroundColor: isComplete ? colors.success : colors.primary,
                            width: `${progressPercent}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.availabilityProgressText, { color: colors.textSecondary }]}>
                      {respondedCount}/{totalRequested}
                    </Text>
                  </View>

                  <View style={styles.availabilityStatsRow}>
                    <View style={styles.availabilityStat}>
                      <View style={[styles.availabilityStatIcon, { backgroundColor: colors.success + '15' }]}>
                        <Ionicons name="checkmark" size={12} color={colors.success} />
                      </View>
                      <Text style={[styles.availabilityStatLabel, { color: colors.textMuted }]}>
                        {language === 'ko' ? '가능' : 'Yes'}
                      </Text>
                      <Text style={[styles.availabilityStatValue, { color: colors.textPrimary }]}>
                        {availableCount}
                      </Text>
                    </View>
                    <View style={styles.availabilityStat}>
                      <View style={[styles.availabilityStatIcon, { backgroundColor: colors.error + '15' }]}>
                        <Ionicons name="close" size={12} color={colors.error} />
                      </View>
                      <Text style={[styles.availabilityStatLabel, { color: colors.textMuted }]}>
                        {language === 'ko' ? '불가' : 'No'}
                      </Text>
                      <Text style={[styles.availabilityStatValue, { color: colors.textPrimary }]}>
                        {unavailableCount}
                      </Text>
                    </View>
                    <View style={styles.availabilityStat}>
                      <View style={[styles.availabilityStatIcon, { backgroundColor: colors.warning + '15' }]}>
                        <Ionicons name="time-outline" size={12} color={colors.warning} />
                      </View>
                      <Text style={[styles.availabilityStatLabel, { color: colors.textMuted }]}>
                        {language === 'ko' ? '대기' : 'Pending'}
                      </Text>
                      <Text style={[styles.availabilityStatValue, { color: colors.textPrimary }]}>
                        {pendingRequests.length}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.availabilityEmpty}>
                  <View style={[styles.availabilityEmptyIcon, { backgroundColor: colors.primary + '10' }]}>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.availabilityEmptyText, { color: colors.textSecondary }]}>
                    {language === 'ko' ? '응답 요청이 없습니다' : 'No requests yet'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })()}

        {/* QUICK ALERTS - Compact notification bar for leaders */}
        {isLeader && totalAlerts > 0 && (
          <TouchableOpacity
            style={[styles.alertBanner, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '30' }]}
            onPress={() => router.push(`/(main)/team/${team?.id}/alerts`)}
          >
            <View style={styles.alertLeft}>
              <View style={[styles.alertIcon, { backgroundColor: colors.warning }]}>
                <Ionicons name="notifications" size={14} color="#FFF" />
              </View>
              <Text style={[styles.alertText, { color: colors.textPrimary }]}>
                {language === 'ko'
                  ? `${totalAlerts}개의 알림이 있습니다`
                  : `${totalAlerts} items need attention`}
              </Text>
            </View>
            <View style={styles.alertRight}>
              <View style={[styles.alertBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.alertBadgeText}>{totalAlerts}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}

        {/* TEAM SCHEDULE - Interactive Calendar View */}
        {(() => {
          // Build set of dates that have services from Supabase
          const serviceDateMap = new Map<string, typeof teamServices>();
          teamServices.forEach(service => {
            const existing = serviceDateMap.get(service.service_date) || [];
            serviceDateMap.set(service.service_date, [...existing, service]);
          });

          const today = new Date();
          const year = today.getFullYear();
          const month = today.getMonth();
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const days = language === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

          // Build calendar grid
          const calendarDays: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) calendarDays.push(null);
          for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

          // Get services for selected date, filtering out misconfigured services
          // (services matching a service type name but on the wrong day)
          const allServicesForDate = selectedDate ? serviceDateMap.get(selectedDate) || [] : [];
          const selectedServices = allServicesForDate.filter(service => {
            const nameParts = service.name.split(' ');
            const serviceTypeName = nameParts.slice(1).join(' ') || service.name;
            const matchingServiceType = serviceTypes.find(st => st.name === serviceTypeName);

            if (matchingServiceType) {
              // If service name matches a service type, only show if day matches
              const dayOfWeek = parseLocalDate(service.service_date).getDay();
              return matchingServiceType.defaultDay === dayOfWeek;
            }
            // Truly ad-hoc service (name doesn't match any service type) - show it
            return true;
          });

          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '팀 스케줄' : 'Team Schedule'}
                </Text>
                {teamServices.length > 0 && (
                  <View style={[styles.progressBadge, { backgroundColor: colors.success + '15' }]}>
                    <Text style={[styles.progressText, { color: colors.success }]}>
                      {teamServices.length}{language === 'ko' ? '개' : ''}
                    </Text>
                  </View>
                )}
              </View>

              <View style={[styles.calendarCard, { backgroundColor: colors.surface }]}>
                {/* Month Header */}
                <Text style={[styles.calendarMonth, { color: colors.textPrimary }]}>
                  {today.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'long' })}
                </Text>

                {/* Day Headers */}
                <View style={styles.calendarDayHeaders}>
                  {days.map((day, i) => (
                    <Text
                      key={i}
                      style={[
                        styles.calendarDayHeader,
                        { color: i === 0 ? colors.error : i === 6 ? colors.info : colors.textMuted }
                      ]}
                    >
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Calendar Grid */}
                {teamServicesLoading ? (
                  <View style={styles.calendarLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : (
                  <View style={styles.calendarGrid}>
                    {calendarDays.map((day, index) => {
                      if (day === null) {
                        return <View key={`empty-${index}`} style={styles.calendarCell} />;
                      }
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayOfWeek = (firstDay + day - 1) % 7;
                      const isToday = day === today.getDate();
                      const isSelected = selectedDate === dateStr;
                      const isSunday = dayOfWeek === 0;
                      const isSaturday = dayOfWeek === 6;

                      // Filter out misconfigured services (matching service type name but wrong day)
                      const allServicesForDate = serviceDateMap.get(dateStr) || [];
                      const servicesForDate = allServicesForDate.filter(s => {
                        const nameParts = s.name.split(' ');
                        const serviceTypeName = nameParts.slice(1).join(' ') || s.name;
                        const matchingServiceType = serviceTypes.find(st => st.name === serviceTypeName);
                        if (matchingServiceType) {
                          return matchingServiceType.defaultDay === dayOfWeek;
                        }
                        return true; // Ad-hoc services (no matching type) are shown
                      });
                      const hasSchedule = servicesForDate.length > 0;

                      // Check how many services on this date have assignments (confirmed)
                      // Count total services and confirmed services
                      const totalServicesForDate = servicesForDate.length;
                      let confirmedServicesCount = 0;

                      servicesForDate.forEach(s => {
                        // Check detailed service info first (most accurate)
                        const detailedInfo = detailedServicesMap.get(s.id);
                        if (detailedInfo && detailedInfo.assignment_count > 0) {
                          confirmedServicesCount++;
                          return;
                        }
                        // Then check Supabase aggregated assignment_count
                        if (s.assignment_count && s.assignment_count > 0) {
                          confirmedServicesCount++;
                          return;
                        }
                        // Check local store assignments by matching service name/type
                        // Service name format is "M/D ServiceTypeName", extract the type name
                        const nameParts = s.name.split(' ');
                        const serviceTypeName = nameParts.slice(1).join(' ') || s.name;
                        const matchingServiceType = serviceTypes.find(st => st.name === serviceTypeName);
                        if (matchingServiceType) {
                          const localSchedule = schedules[`${dateStr}:${matchingServiceType.id}`];
                          if (localSchedule && Object.keys(localSchedule.assignments || {}).length > 0) {
                            confirmedServicesCount++;
                          }
                        }
                      });

                      // Green = all confirmed, Orange = partial/in-progress, Warning outline = pending
                      const isAllConfirmed = totalServicesForDate > 0 && confirmedServicesCount >= totalServicesForDate;
                      const isPartiallyConfirmed = confirmedServicesCount > 0 && confirmedServicesCount < totalServicesForDate;
                      const scheduleColor = isAllConfirmed ? colors.success : (isPartiallyConfirmed ? colors.info : colors.warning);

                      return (
                        <Pressable
                          key={day}
                          style={styles.calendarCell}
                          onPress={() => {
                            if (hasSchedule) {
                              setSelectedDate(isSelected ? null : dateStr);
                            }
                          }}
                        >
                          <View style={[
                            styles.calendarDay,
                            // Today: just border outline (not filled)
                            isToday && !isSelected && {
                              borderWidth: 2,
                              borderColor: colors.primary,
                              backgroundColor: 'transparent',
                            },
                            // Selected: filled with primary color
                            isSelected && { backgroundColor: colors.primary, transform: [{ scale: 1.1 }] },
                            // Has schedule but not today and not selected: colored background
                            hasSchedule && !isToday && !isSelected && { backgroundColor: scheduleColor + '20' },
                          ]}>
                            <Text style={[
                              styles.calendarDayText,
                              // Selected = white text, Today = primary text, others = normal
                              { color: isSelected ? '#FFF' : isToday ? colors.primary : isSunday ? colors.error : isSaturday ? colors.info : colors.textPrimary },
                              (hasSchedule || isToday) && !isSelected && { fontWeight: '700' },
                            ]}>
                              {day}
                            </Text>
                            {/* Show dot for scheduled dates (not for today) */}
                            {hasSchedule && !isSelected && !isToday && (
                              <View style={[styles.calendarDot, { backgroundColor: scheduleColor }]} />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Legend */}
                <View style={styles.calendarLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDotOutline, { borderColor: colors.primary }]} />
                    <Text style={[styles.legendText, { color: colors.textMuted }]}>
                      {language === 'ko' ? '오늘' : 'Today'}
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.legendText, { color: colors.textMuted }]}>
                      {language === 'ko' ? '확정' : 'Confirmed'}
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
                    <Text style={[styles.legendText, { color: colors.textMuted }]}>
                      {language === 'ko' ? '진행중' : 'In Progress'}
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                    <Text style={[styles.legendText, { color: colors.textMuted }]}>
                      {language === 'ko' ? '대기' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Selected Date Services */}
              {selectedDate && selectedServices.length > 0 && (
                <View style={[styles.selectedDateCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.selectedDateHeader}>
                    <Text style={[styles.selectedDateTitle, { color: colors.textPrimary }]}>
                      {(() => {
                        const date = parseLocalDate(selectedDate);
                        const dayNames = language === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        if (language === 'ko') {
                          return `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;
                        }
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
                      })()}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedDate(null)}>
                      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {selectedServices.map((service, index) => {
                    const dateObj = parseLocalDate(service.service_date);
                    const isSunday = dateObj.getDay() === 0;

                    // Check detailed service info (fetched individually), then Supabase aggregated, then local store
                    let localAssignmentCount = 0;
                    // Match by service name to find the correct service type
                    // Service name format is "M/D ServiceTypeName", extract the type name
                    const nameParts = service.name.split(' ');
                    const serviceTypeName = nameParts.slice(1).join(' ') || service.name;
                    const matchingServiceType = serviceTypes.find(st => st.name === serviceTypeName);
                    if (matchingServiceType) {
                      const localSchedule = schedules[`${service.service_date}:${matchingServiceType.id}`];
                      if (localSchedule?.assignments) {
                        localAssignmentCount = Object.keys(localSchedule.assignments).length;
                      }
                    }

                    // Use detailed info first (most accurate), then fallback to aggregated or local
                    const detailedInfo = detailedServicesMap.get(service.id);
                    const totalAssignments = detailedInfo?.assignment_count ?? Math.max(service.assignment_count || 0, localAssignmentCount);
                    const confirmedAssignments = detailedInfo?.confirmed_count ?? (service.confirmed_count || localAssignmentCount);
                    const isConfirmedService = totalAssignments > 0;
                    const statusColor = isConfirmedService ? colors.success : colors.warning;
                    const statusText = isConfirmedService
                      ? (language === 'ko' ? '확정' : 'Confirmed')
                      : (language === 'ko' ? '대기' : 'Pending');

                    return (
                      <TouchableOpacity
                        key={service.id}
                        style={[
                          styles.selectedServiceRow,
                          index < selectedServices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
                        ]}
                        onPress={() => router.push(`/(main)/team/${team?.id}/services/${service.id}`)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.serviceTimeBox, { backgroundColor: isSunday ? colors.error + '15' : colors.primary + '15' }]}>
                          <Ionicons name="time-outline" size={14} color={isSunday ? colors.error : colors.primary} />
                          <Text style={[styles.serviceTimeText, { color: isSunday ? colors.error : colors.primary }]}>
                            {service.start_time?.slice(0, 5)}
                          </Text>
                        </View>
                        <View style={styles.serviceDetailInfo}>
                          <Text style={[styles.serviceDetailName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {service.name}
                          </Text>
                          <View style={styles.serviceDetailMeta}>
                            <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                            <Text style={[styles.serviceDetailMetaText, { color: colors.textMuted }]}>
                              {totalAssignments > 0
                                ? `${confirmedAssignments}/${totalAssignments}${language === 'ko' ? '명' : ''}`
                                : (language === 'ko' ? '배정 없음' : 'No assignments')}
                            </Text>
                          </View>
                        </View>
                        {/* Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                          <Ionicons
                            name={isConfirmedService ? 'checkmark-circle' : 'time-outline'}
                            size={12}
                            color={statusColor}
                          />
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {statusText}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Empty State when no services */}
              {!teamServicesLoading && teamServices.length === 0 && (
                <View style={[styles.emptyCalendarState, { backgroundColor: colors.surface }]}>
                  <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.emptyCalendarText, { color: colors.textSecondary }]}>
                    {language === 'ko' ? '확정된 예배 일정이 없습니다' : 'No confirmed services'}
                  </Text>
                  <Text style={[styles.emptyCalendarSubtext, { color: colors.textMuted }]}>
                    {language === 'ko' ? '리더가 스케줄을 확정하면 여기에 표시됩니다' : 'Services will appear here when confirmed'}
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // Compact Welcome Header
  welcomeHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  welcomeName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  userNameLoading: {
    height: 28,
    justifyContent: 'center',
    minWidth: 60,
  },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  leaderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  dateText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sections
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  progressBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Schedule Hero Cards
  scheduleHeroRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  scheduleHeroCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    minHeight: 140,
    justifyContent: 'space-between',
    ...shadows.md,
  },
  heroIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  heroStep: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStepText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Upcoming Card
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  upcomingDateBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  upcomingDateMonth: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  upcomingDateDay: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -2,
  },
  upcomingContent: {
    flex: 1,
  },
  upcomingName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 4,
  },
  upcomingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  upcomingTime: {
    fontSize: fontSize.xs,
  },
  // Empty & Loading
  loadingCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  emptyCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
  // Alert Banner
  alertBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  alertRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  alertBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Availability Card - Redesigned
  availabilityCardNew: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  availabilityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  availabilityTitleNew: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  availabilityBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  availabilityProgress: {
    gap: spacing.sm,
  },
  availabilityProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  availabilityProgressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  availabilityProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  availabilityProgressText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  availabilityStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  availabilityStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availabilityStatIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityStatLabel: {
    fontSize: fontSize.xs,
  },
  availabilityStatValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  availabilityEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  availabilityEmptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityEmptyText: {
    fontSize: fontSize.sm,
  },
  // Member Pending Cards
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  pendingDate: {
    fontSize: fontSize.sm,
  },
  respondBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  respondBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Member Service List
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  serviceDate: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  serviceDateNum: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  serviceRole: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  // Pending Request Cards (응답 대기)
  pendingRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  pendingRequestInfo: {
    flex: 1,
  },
  pendingRequestName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  pendingRequestDate: {
    fontSize: fontSize.sm,
  },
  pendingRequestBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  pendingRequestBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 4,
  },
  viewMoreText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Team Schedule Card
  teamScheduleCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  teamScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  teamScheduleDateBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamScheduleDay: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  teamScheduleDateNum: {
    fontSize: fontSize.base,
    fontWeight: '700',
    marginTop: -2,
  },
  teamScheduleInfo: {
    flex: 1,
  },
  teamScheduleName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  teamScheduleMeta: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  // Schedule Overview
  scheduleOverviewCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  scheduleOverviewItem: {
    padding: spacing.md,
  },
  scheduleItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scheduleOverviewDateBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleOverviewDayWhite: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  scheduleOverviewDateNumWhite: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -2,
  },
  scheduleItemHeaderText: {
    flex: 1,
  },
  scheduleItemDateText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  scheduleItemCount: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleItemAssignments: {
    marginTop: spacing.sm,
    marginLeft: 44 + spacing.sm,
    gap: 4,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  assignmentEmoji: {
    fontSize: 14,
    width: 20,
  },
  assignmentNames: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  moreAssignments: {
    fontSize: fontSize.xs,
    marginLeft: 20,
  },
  noAssignments: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 4,
  },
  viewAllText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Compact Schedule Rows
  scheduleCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  scheduleCompactDate: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCompactDay: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scheduleCompactNum: {
    fontSize: fontSize.base,
    fontWeight: '700',
    marginTop: -1,
  },
  scheduleCompactInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  scheduleCompactEmoji: {
    fontSize: 12,
  },
  scheduleCompactCount: {
    fontSize: fontSize.xs,
    marginLeft: spacing.xs,
  },
  scheduleViewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 4,
  },
  scheduleViewAllText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Calendar View
  calendarCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  calendarMonth: {
    fontSize: fontSize.base,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  calendarDayHeaders: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  calendarDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
  },
  calendarDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
  },
  todayLabel: {
    fontSize: 8,
    fontWeight: '700',
    position: 'absolute',
    bottom: 2,
  },
  calendarLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotOutline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  legendText: {
    fontSize: fontSize.xs,
  },
  // Selected Date Card
  selectedDateCard: {
    borderRadius: borderRadius.xl,
    marginTop: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  selectedDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  selectedDateTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  selectedServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  serviceTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  serviceTimeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  serviceDetailInfo: {
    flex: 1,
  },
  serviceDetailName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  serviceDetailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  serviceDetailMetaText: {
    fontSize: fontSize.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
    marginRight: spacing.sm,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  // Empty Calendar State
  emptyCalendarState: {
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  emptyCalendarText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  emptyCalendarSubtext: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
