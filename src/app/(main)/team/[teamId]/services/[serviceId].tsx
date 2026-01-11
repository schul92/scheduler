/**
 * Service Detail Screen
 *
 * Shows service information and team assignments
 * Fetches real data from the database
 * Updated: fixed role_id query
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeNavigation } from '../../../../../hooks/useNavigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../../providers/LanguageProvider';
import { useTeamStore } from '../../../../../store/teamStore';
import { usePermissions } from '../../../../../hooks/usePermissions';
import { useSchedulingStore } from '../../../../../store/schedulingStore';
import { useServiceTypeStore } from '../../../../../store/serviceTypeStore';
import { supabase } from '../../../../../lib/supabase';
import { spacing, borderRadius, fontSize, shadows, lightColors } from '../../../../../lib/theme';

const staticColors = lightColors;

// Role/instrument configuration
const ROLE_CONFIG: Record<string, { name: string; nameEn: string; emoji: string }> = {
  leader: { name: '인도자', nameEn: 'Leader', emoji: '🎤' },
  keyboard: { name: '건반', nameEn: 'Keys', emoji: '🎹' },
  drums: { name: '드럼', nameEn: 'Drums', emoji: '🥁' },
  electric: { name: '일렉기타', nameEn: 'E.Guitar', emoji: '🎸' },
  bass: { name: '베이스', nameEn: 'Bass', emoji: '🎻' },
  acoustic: { name: '어쿠스틱', nameEn: 'Acoustic', emoji: '🪕' },
  vocals: { name: '싱어', nameEn: 'Vocals', emoji: '🎵' },
  violin: { name: '바이올린', nameEn: 'Violin', emoji: '🎻' },
};

interface ServiceData {
  id: string;
  name: string;
  service_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  notes: string | null;
}

interface Assignment {
  id: string;
  roleId: string;
  memberId: string;
  memberName: string;
  status: 'pending' | 'confirmed' | 'declined';
}

export default function ServiceDetailScreen() {
  const router = useRouter();
  const { safeGoBack } = useSafeNavigation();
  const { teamId, serviceId } = useLocalSearchParams<{
    teamId: string;
    serviceId: string;
  }>();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { activeTeamId } = useTeamStore();
  const { isAdmin, isOwner } = usePermissions(activeTeamId ?? undefined);
  const isLeader = isAdmin || isOwner;

  // Local store for assignments
  const { schedules } = useSchedulingStore();
  const { getServiceTypes } = useServiceTypeStore();

  // Memoize serviceTypes to prevent infinite loops
  const serviceTypes = useMemo(() => getServiceTypes(teamId || ''), [getServiceTypes, teamId]);

  const [service, setService] = useState<ServiceData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; nickname: string | null; user: { full_name: string | null } | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse date string as local date (avoids UTC issues)
  const parseLocalDate = useCallback((dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, []);

  // Compute local assignments (memoized to avoid infinite loops)
  const localAssignments = useMemo(() => {
    if (!service?.service_date || teamMembers.length === 0) return [];

    const dateStr = service.service_date;
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    const matchingTypes = serviceTypes.filter(st => st.defaultDay === dayOfWeek);

    const localAssigns: Assignment[] = [];

    matchingTypes.forEach(st => {
      const scheduleKey = `${dateStr}:${dateStr}-${st.id}`;
      const schedule = schedules[scheduleKey] || schedules[dateStr];

      if (schedule?.assignments) {
        Object.entries(schedule.assignments).forEach(([key, memberId]) => {
          if (!memberId || typeof memberId !== 'string') return;

          const [roleId] = key.split('-');
          const member = teamMembers.find(m => m.id === memberId);
          const memberName = member?.nickname || member?.user?.full_name || 'Unknown';

          localAssigns.push({
            id: `local-${key}`,
            roleId,
            memberId,
            memberName,
            status: 'confirmed',
          });
        });
      }
    });

    return localAssigns;
  }, [service?.service_date, schedules, serviceTypes, teamMembers, parseLocalDate]);

  // Fetch service and assignments
  const fetchData = useCallback(async () => {
    if (!teamId || !serviceId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch service details
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (serviceError) {
        // Service might not exist in DB yet - show empty state
        setService(null);
        setAssignments([]);
        return;
      }

      setService({
        id: serviceData.id,
        name: serviceData.name || 'Service',
        service_date: serviceData.service_date,
        start_time: serviceData.start_time || '09:00',
        end_time: serviceData.end_time,
        location: serviceData.location,
        status: serviceData.status || 'draft',
        notes: serviceData.notes,
      });

      // Fetch assignments for this service
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('service_assignments')
        .select(`
          id,
          role_id,
          status,
          team_member_id,
          team_members:team_member_id (
            id,
            nickname,
            users:user_id (full_name)
          ),
          roles:role_id (
            id,
            name,
            name_ko
          )
        `)
        .eq('service_id', serviceId);

      if (assignmentError) {
        console.error('Error fetching assignments:', assignmentError);
        setAssignments([]);
        return;
      }

      // Transform assignments
      const transformedAssignments: Assignment[] = (assignmentData || []).map((a: any) => ({
        id: a.id,
        roleId: a.roles?.name?.toLowerCase() || a.role_id || 'unknown',
        memberId: a.team_member_id,
        memberName: a.team_members?.nickname || a.team_members?.users?.full_name || 'Unknown',
        status: a.status || 'pending',
      }));

      setAssignments(transformedAssignments);
    } catch (err) {
      console.error('Error fetching service data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load service');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, serviceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch team members for local assignment name resolution
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!teamId) return;
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select(`
            id,
            nickname,
            user:users!team_members_user_id_fkey (
              full_name
            )
          `)
          .eq('team_id', teamId)
          .eq('status', 'active');

        if (!error && data) {
          setTeamMembers(data);
        }
      } catch (err) {
        console.error('Error fetching team members:', err);
      }
    };
    fetchTeamMembers();
  }, [teamId]);


  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (language === 'ko') {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]}요일)`;
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (start: string, end: string | null) => {
    if (end) {
      return `${start} - ${end}`;
    }
    return start;
  };

  // Use local assignments if DB has none
  const displayAssignments = assignments.length > 0 ? assignments : localAssignments;

  // Group assignments by role
  const assignmentsByRole: Record<string, Assignment[]> = {};
  displayAssignments.forEach(a => {
    if (!assignmentsByRole[a.roleId]) {
      assignmentsByRole[a.roleId] = [];
    }
    assignmentsByRole[a.roleId].push(a);
  });

  // Get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { icon: 'checkmark-circle' as const, color: colors.success, text: language === 'ko' ? '확정' : 'Confirmed' };
      case 'declined':
        return { icon: 'close-circle' as const, color: colors.error, text: language === 'ko' ? '불참' : 'Declined' };
      default:
        return { icon: 'time' as const, color: colors.warning, text: language === 'ko' ? '대기중' : 'Pending' };
    }
  };

  // Count stats
  const confirmedCount = displayAssignments.filter(a => a.status === 'confirmed').length;
  const pendingCount = displayAssignments.filter(a => a.status === 'pending').length;
  const totalCount = displayAssignments.length;

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '예배 상세' : 'Service Details'}
            </Text>
          </View>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {language === 'ko' ? '불러오는 중...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty/error state
  if (!service) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '예배 상세' : 'Service Details'}
            </Text>
          </View>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {language === 'ko' ? '예배 정보가 없습니다' : 'No service data available'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
            {language === 'ko' ? '아직 예배가 등록되지 않았습니다' : 'This service has not been created yet'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '예배 상세' : 'Service Details'}
          </Text>
        </View>
        {isLeader ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push(`/(main)/team/${teamId}/create-schedule?date=${service.service_date}`)}
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.serviceTitleRow}>
            <Text style={[styles.serviceName, { color: colors.textPrimary }]}>{service.name}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: service.status === 'published' ? colors.success + '20' : colors.warning + '20' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: service.status === 'published' ? colors.success : colors.warning }
              ]}>
                {service.status === 'published'
                  ? (language === 'ko' ? '확정' : 'Published')
                  : (language === 'ko' ? '준비중' : 'Draft')}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {formatDate(service.service_date)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {formatTime(service.start_time, service.end_time)}
            </Text>
          </View>

          {service.location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>{service.location}</Text>
            </View>
          )}
        </View>

        {/* Stats Card */}
        {totalCount > 0 && (
          <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{totalCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '전체' : 'Total'}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success }]}>{confirmedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '확정' : 'Confirmed'}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{pendingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {language === 'ko' ? '대기' : 'Pending'}
              </Text>
            </View>
          </View>
        )}

        {/* Assignments Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '배정 현황' : 'Team Assignments'}
          </Text>

          {displayAssignments.length === 0 ? (
            <View style={[styles.emptyAssignments, { backgroundColor: colors.surface }]}>
              <Ionicons name="people-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyAssignmentsText, { color: colors.textSecondary }]}>
                {language === 'ko' ? '아직 배정된 멤버가 없습니다' : 'No members assigned yet'}
              </Text>
            </View>
          ) : (
            Object.entries(assignmentsByRole).map(([roleId, roleAssignments]) => {
              const roleConfig = ROLE_CONFIG[roleId] || { name: roleId, nameEn: roleId, emoji: '🎵' };
              return (
                <View key={roleId} style={[styles.roleCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.roleHeader}>
                    <Text style={styles.roleEmoji}>{roleConfig.emoji}</Text>
                    <Text style={[styles.roleName, { color: colors.textPrimary }]}>
                      {language === 'ko' ? roleConfig.name : roleConfig.nameEn}
                    </Text>
                    <Text style={[styles.roleCount, { color: colors.textMuted }]}>
                      {roleAssignments.length}
                    </Text>
                  </View>
                  {roleAssignments.map((assignment, index) => {
                    const statusInfo = getStatusInfo(assignment.status);
                    return (
                      <View
                        key={assignment.id}
                        style={[
                          styles.memberRow,
                          index < roleAssignments.length - 1 && [styles.memberRowBorder, { borderBottomColor: colors.borderLight }]
                        ]}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                            {assignment.memberName.charAt(0)}
                          </Text>
                        </View>
                        <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                          {assignment.memberName}
                        </Text>
                        <View style={styles.memberStatus}>
                          <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
                          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
                            {statusInfo.text}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>

        {/* Notes Section */}
        {service.notes && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '메모' : 'Notes'}
            </Text>
            <View style={[styles.notesCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                {service.notes}
              </Text>
            </View>
          </View>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  // Loading & Empty States
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
  },
  // Info Card
  infoCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  serviceName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
  },
  // Stats Card
  statsCard: {
    flexDirection: 'row',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  // Empty Assignments
  emptyAssignments: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  emptyAssignmentsText: {
    fontSize: fontSize.sm,
  },
  // Role Card
  roleCard: {
    borderRadius: borderRadius.xl,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  roleEmoji: {
    fontSize: 18,
  },
  roleName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    flex: 1,
  },
  roleCount: {
    fontSize: fontSize.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  memberName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  // Notes
  notesCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  notesText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
