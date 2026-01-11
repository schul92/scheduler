/**
 * Schedule View Screen
 *
 * Shows published schedules in a pretty format
 * Team members can see who's playing on each date
 * Leaders see edit buttons on each date card
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { supabase } from '../../../../lib/supabase';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSchedulingStore, DateScheduleData } from '../../../../store/schedulingStore';
import { useTeamStore } from '../../../../store/teamStore';
import { useServiceTypeStore } from '../../../../store/serviceTypeStore';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { spacing, borderRadius, fontSize, shadows } from '../../../../lib/theme';

// Type for grouped schedule by date
interface GroupedDateSchedule {
  date: string;
  services: {
    key: string;
    serviceId: string;
    serviceName: string;
    serviceTime?: string; // For sorting
    schedule: DateScheduleData;
  }[];
}

// Helper to parse YYYY-MM-DD string as local date (avoids UTC parsing issues)
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Team member type for display
interface TeamMemberDisplay {
  id: string;
  name: string;
}

// Instrument display info
const instrumentInfo: Record<string, { name: string; emoji: string }> = {
  leader: { name: '인도자', emoji: '🎤' },
  keyboard: { name: '건반', emoji: '🎹' },
  synth: { name: '신디사이저', emoji: '🎛️' },
  drums: { name: '드럼', emoji: '🥁' },
  electric: { name: '일렉기타', emoji: '🎸' },
  bass: { name: '베이스', emoji: '🎻' },
  acoustic: { name: '어쿠스틱', emoji: '🪕' },
  vocals: { name: '싱어', emoji: '🎵' },
  violin: { name: '바이올린', emoji: '🎻' },
  pd: { name: 'PD', emoji: '🎬' },
  fd: { name: 'FD', emoji: '📋' },
  subtitles: { name: '자막', emoji: '💬' },
  lighting: { name: '조명', emoji: '💡' },
  sound: { name: '음향', emoji: '🔊' },
  camera: { name: '카메라', emoji: '📷' },
};

export default function ScheduleViewScreen() {
  const router = useRouter();
  const { teamId: routeTeamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { schedules, periodTitle } = useSchedulingStore();
  const { activeTeamId } = useTeamStore();
  const { getServiceTypes } = useServiceTypeStore();
  // Use route param first, fallback to store's activeTeamId
  const teamId = routeTeamId || activeTeamId;
  const serviceTypes = getServiceTypes(teamId || '');
  const { isAdmin, isOwner } = usePermissions(teamId ?? undefined);
  const isLeader = isAdmin || isOwner;

  const days = ['일', '월', '화', '수', '목', '금', '토'];

  // Team members state - fetched from database
  const [teamMembers, setTeamMembers] = useState<TeamMemberDisplay[]>([]);

  // Fetch team members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!teamId) return;

      try {
        const { data: members, error } = await supabase
          .from('team_members')
          .select(`
            id,
            nickname,
            users:user_id (full_name)
          `)
          .eq('team_id', teamId)
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching team members:', error);
          return;
        }

        const displayMembers: TeamMemberDisplay[] = (members || []).map((m: any) => ({
          id: m.id,
          name: m.nickname || m.users?.full_name || 'Unknown',
        }));

        setTeamMembers(displayMembers);
      } catch (err) {
        console.error('Error fetching members:', err);
      }
    };

    fetchMembers();
  }, [teamId]);

  // Track expanded dates - first date expanded by default
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Toggle date expansion with animation
  const toggleDateExpansion = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Get published schedules and group by date
  const publishedSchedules = Object.entries(schedules)
    .filter(([_, s]) => s.status === 'published')
    .sort(([a], [b]) => a.localeCompare(b));

  // Group schedules by date
  const groupedByDate: GroupedDateSchedule[] = [];
  const dateMap = new Map<string, GroupedDateSchedule>();

  publishedSchedules.forEach(([key, schedule]) => {
    // Extract actual date from composite key (format: "date:serviceId" or just "date")
    const actualDate = key.includes(':') ? key.split(':')[0] : key;
    const serviceId = key.includes(':') ? key.split(':')[1] : '';

    // Get service name and time from serviceId or default
    let serviceName = language === 'ko' ? '예배' : 'Service';
    let serviceTime: string | undefined;
    if (serviceId) {
      // serviceId format: "2026-01-04-st_default_0" or "2026-01-04-st_1234567890"
      // Find service type whose ID is contained in the serviceId
      const matchingType = serviceTypes.find(st => serviceId.includes(st.id));
      if (matchingType) {
        serviceName = matchingType.name;
        serviceTime = matchingType.serviceTime;
      }
    }

    if (!dateMap.has(actualDate)) {
      const group: GroupedDateSchedule = { date: actualDate, services: [] };
      dateMap.set(actualDate, group);
      groupedByDate.push(group);
    }

    dateMap.get(actualDate)!.services.push({
      key,
      serviceId,
      serviceName,
      serviceTime,
      schedule,
    });
  });

  // Sort groups by date
  groupedByDate.sort((a, b) => a.date.localeCompare(b.date));

  // Sort services within each date by service time (earlier first)
  groupedByDate.forEach(group => {
    group.services.sort((a, b) => {
      // Services without time go last
      if (!a.serviceTime && !b.serviceTime) return 0;
      if (!a.serviceTime) return 1;
      if (!b.serviceTime) return -1;
      return a.serviceTime.localeCompare(b.serviceTime);
    });
  });

  // Get member by ID from fetched team members
  const getMemberById = (id: string) => teamMembers.find(m => m.id === id);

  // Group assignments by instrument for a schedule
  const getGroupedAssignments = (assignments: Record<string, string>) => {
    const grouped: Record<string, { name: string; emoji: string; members: string[] }> = {};

    Object.entries(assignments).forEach(([key, memberId]) => {
      const [instrumentId] = key.split('-');
      const member = getMemberById(memberId);
      const inst = instrumentInfo[instrumentId] || { name: instrumentId, emoji: '🎵' };

      if (!grouped[instrumentId]) {
        grouped[instrumentId] = { ...inst, members: [] };
      }
      if (member && !grouped[instrumentId].members.includes(member.name)) {
        grouped[instrumentId].members.push(member.name);
      }
    });

    // Sort by instrument order
    const order = ['leader', 'keyboard', 'synth', 'drums', 'electric', 'bass', 'acoustic', 'vocals'];
    return Object.entries(grouped).sort(([a], [b]) => {
      const aIdx = order.indexOf(a);
      const bIdx = order.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '이번 달 스케줄' : 'This Month\'s Schedule'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {periodTitle || '2026년 1월 찬양'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {groupedByDate.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {language === 'ko' ? '아직 게시된 스케줄이 없습니다' : 'No published schedules yet'}
            </Text>
          </View>
        ) : (
          groupedByDate.map((dateGroup) => {
            const dateObj = parseLocalDate(dateGroup.date);
            const isSunday = dateObj.getDay() === 0;
            const totalAssigned = dateGroup.services.reduce(
              (sum, s) => sum + Object.keys(s.schedule.assignments).length, 0
            );
            const isExpanded = expandedDates.has(dateGroup.date);

            return (
              <View
                key={dateGroup.date}
                style={[styles.dateCard, { backgroundColor: colors.surface }]}
              >
                {/* Date Header - Tappable to expand/collapse */}
                <TouchableOpacity
                  style={styles.dateHeader}
                  onPress={() => toggleDateExpansion(dateGroup.date)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dateBox, { backgroundColor: isSunday ? colors.error : colors.primary }]}>
                    <Text style={styles.dateDay}>{days[dateObj.getDay()]}</Text>
                    <Text style={styles.dateNum}>{dateObj.getDate()}</Text>
                  </View>
                  <View style={styles.dateInfo}>
                    <Text style={[styles.dateFullText, { color: colors.textPrimary }]}>
                      {dateObj.getMonth() + 1}월 {dateObj.getDate()}일 ({days[dateObj.getDay()]})
                    </Text>
                    <View style={styles.dateMeta}>
                      {dateGroup.services.map((s, i) => (
                        <View key={i} style={[styles.serviceChip, { backgroundColor: colors.primary + '15' }]}>
                          <Text style={[styles.serviceChipText, { color: colors.primary }]} numberOfLines={1}>
                            {s.serviceName}
                          </Text>
                        </View>
                      ))}
                      <Text style={[styles.assignedCount, { color: colors.textMuted }]}>
                        {totalAssigned}{language === 'ko' ? '명' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.headerActions}>
                    {isLeader && teamId && (
                      <TouchableOpacity
                        style={[styles.editBtn, { backgroundColor: colors.background }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/(main)/team/${teamId}/create-schedule?date=${dateGroup.date}`);
                        }}
                      >
                        <Ionicons name="pencil" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    <View style={[styles.expandIcon, { backgroundColor: colors.background }]}>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expandable Content */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Services for this date */}
                    {dateGroup.services.map((service, serviceIdx) => {
                      const grouped = getGroupedAssignments(service.schedule.assignments);
                      const serviceAssigned = Object.keys(service.schedule.assignments).length;

                      return (
                        <View key={service.key}>
                          {/* Service Header - always show to label the sub group */}
                          <View style={[
                            styles.serviceHeader,
                            { borderTopColor: colors.border },
                            serviceIdx === 0 && styles.serviceHeaderFirst
                          ]}>
                            <View style={[styles.serviceTag, { backgroundColor: colors.primary + '15' }]}>
                              <Ionicons name="musical-notes" size={12} color={colors.primary} />
                              <Text style={[styles.serviceTagText, { color: colors.primary }]}>
                                {service.serviceName}
                              </Text>
                            </View>
                            <Text style={[styles.serviceAssigned, { color: colors.textMuted }]}>
                              {serviceAssigned}{language === 'ko' ? '명 배정' : ' assigned'}
                            </Text>
                          </View>

                          {/* Assignments by Instrument */}
                          <View style={styles.assignmentsSectionIndented}>
                            {grouped.length > 0 ? (
                              grouped.map(([instId, data]) => (
                                <View key={instId} style={[styles.instrumentRow, { borderTopColor: colors.border }]}>
                                  <View style={styles.instrumentLabel}>
                                    <Text style={styles.instrumentEmoji}>{data.emoji}</Text>
                                    <Text style={[styles.instrumentName, { color: colors.textSecondary }]}>
                                      {data.name}
                                    </Text>
                                  </View>
                                  <View style={styles.membersList}>
                                    {data.members.map((name, idx) => (
                                      <View
                                        key={idx}
                                        style={[styles.memberChip, { backgroundColor: colors.primary + '12' }]}
                                      >
                                        <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                                          {name}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              ))
                            ) : (
                              <View style={styles.noAssignments}>
                                <Text style={[styles.noAssignmentsText, { color: colors.textMuted }]}>
                                  {language === 'ko' ? '배정된 팀원이 없습니다' : 'No assignments yet'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyState: {
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  dateCard: {
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  dateNum: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -2,
  },
  dateInfo: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    overflow: 'hidden',
  },
  serviceChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    maxWidth: 80,
  },
  serviceChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dateFullText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  dateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  assignedCount: {
    fontSize: fontSize.xs,
  },
  assignmentsSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  assignmentsSectionIndented: {
    paddingLeft: spacing.lg,
    paddingBottom: spacing.sm,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  serviceHeaderFirst: {
    borderTopWidth: 0,
    marginTop: 0,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  serviceTagText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  serviceAssigned: {
    fontSize: fontSize.xs,
  },
  instrumentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  instrumentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 80,
  },
  instrumentEmoji: {
    fontSize: 16,
  },
  instrumentName: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  membersList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  memberChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  memberName: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  noAssignments: {
    paddingVertical: spacing.md,
  },
  noAssignmentsText: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
