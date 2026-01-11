/**
 * Alerts Overview Screen
 *
 * Shows all notifications that need leader attention:
 * - Schedule conflicts (members responding unavailable after assignment)
 * - Pending member responses (fetched from database)
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeNavigation } from '../../../../hooks/useNavigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { useConflictStore } from '../../../../store/conflictStore';
import { supabase } from '../../../../lib/supabase';
import { getTeamServices } from '../../../../lib/api/services';
import { spacing, borderRadius, fontSize, shadows } from '../../../../lib/theme';

interface PendingMember {
  id: string;
  name: string;
  lastReminded: string | null;
}

export default function AlertsScreen() {
  const router = useRouter();
  const { safeGoBack } = useSafeNavigation();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { getUnresolvedConflicts, resolveConflict } = useConflictStore();
  const unresolvedConflicts = getUnresolvedConflicts();

  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch pending members (those who haven't submitted availability for published services)
  const fetchPendingMembers = useCallback(async () => {
    if (!teamId) {
      setPendingMembers([]);
      setIsLoading(false);
      return;
    }

    try {
      // Get current user ID to exclude from list
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserId = currentUser?.id;

      // Get published services from Supabase (same source as calendar)
      const today = new Date().toISOString().split('T')[0];
      const services = await getTeamServices(teamId, {
        startDate: today,
        includePast: false,
        status: ['published', 'completed'],
      });

      if (services.length === 0) {
        setPendingMembers([]);
        setIsLoading(false);
        return;
      }

      // Extract dates from services
      const serviceDates = [...new Set(services.map(s => s.service_date))];

      // Get all team members
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          nickname,
          users:user_id (full_name)
        `)
        .eq('team_id', teamId)
        .eq('status', 'active');

      if (membersError) throw membersError;

      // Get all availability responses for service dates
      const { data: availability, error: availabilityError } = await supabase
        .from('availability')
        .select('user_id, date')
        .eq('team_id', teamId)
        .in('date', serviceDates);

      if (availabilityError) throw availabilityError;

      // Find members who haven't responded to ALL service dates
      // Exclude current user - they can handle their own availability via "내가능여부"
      const respondedUserIds = new Set((availability || []).map(a => a.user_id));
      const pending: PendingMember[] = (members || [])
        .filter(m => !respondedUserIds.has(m.user_id) && m.user_id !== currentUserId)
        .map(m => ({
          id: m.id,
          name: m.nickname || (m.users as any)?.full_name || 'Unknown',
          lastReminded: null, // TODO: Track reminder timestamps
        }));

      setPendingMembers(pending);
    } catch (error) {
      console.error('Error fetching pending members:', error);
      setPendingMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchPendingMembers();
  }, [fetchPendingMembers]);

  const handleConflict = (conflict: typeof unresolvedConflicts[0]) => {
    Alert.alert(
      language === 'ko' ? '스케줄 충돌' : 'Schedule Conflict',
      language === 'ko'
        ? `${conflict.memberName}님이 ${conflict.serviceDate} ${conflict.instrumentName} 배정에 불가 응답했습니다.\n\n어떻게 처리하시겠습니까?`
        : `${conflict.memberName} responded unavailable for ${conflict.instrumentName} on ${conflict.serviceDate}.\n\nHow would you like to handle this?`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '다른 멤버 배정' : 'Assign Other',
          onPress: () => {
            resolveConflict(conflict.id);
            router.push(`/(main)/team/${teamId}/create-schedule?date=${conflict.serviceDate}`);
          }
        },
        {
          text: language === 'ko' ? '그대로 유지' : 'Keep As Is',
          onPress: () => resolveConflict(conflict.id)
        }
      ]
    );
  };

  const handleRemindMember = (memberId: string, memberName: string) => {
    Alert.alert(
      language === 'ko' ? '알림 전송' : 'Send Reminder',
      language === 'ko'
        ? `${memberName}님에게 응답 요청 알림을 보내시겠습니까?`
        : `Send a reminder to ${memberName}?`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '보내기' : 'Send',
          onPress: () => {
            // TODO: Send push notification
            Alert.alert(
              language === 'ko' ? '전송 완료' : 'Sent',
              language === 'ko' ? '알림이 전송되었습니다.' : 'Reminder sent.'
            );
          }
        }
      ]
    );
  };

  const handleRemindAll = () => {
    Alert.alert(
      language === 'ko' ? '전체 알림' : 'Remind All',
      language === 'ko'
        ? `${pendingMembers.length}명에게 응답 요청 알림을 보내시겠습니까?`
        : `Send reminders to ${pendingMembers.length} members?`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '전체 보내기' : 'Send All',
          onPress: () => {
            Alert.alert(
              language === 'ko' ? '전송 완료' : 'Sent',
              language === 'ko' ? '알림이 전송되었습니다.' : 'Reminders sent.'
            );
          }
        }
      ]
    );
  };

  const totalAlerts = unresolvedConflicts.length + pendingMembers.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {language === 'ko' ? '알림 현황' : 'Alerts'}
        </Text>
        <View style={[styles.headerBadge, { backgroundColor: colors.warning }]}>
          <Text style={styles.headerBadgeText}>{totalAlerts}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Schedule Conflicts Section */}
        {unresolvedConflicts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '스케줄 충돌' : 'Schedule Conflicts'}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.countBadgeText}>{unresolvedConflicts.length}</Text>
              </View>
            </View>

            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              {language === 'ko'
                ? '배정된 멤버가 해당 날짜에 불가 응답했습니다'
                : 'Assigned members responded unavailable'}
            </Text>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {unresolvedConflicts.map((conflict, index) => {
                const dateObj = new Date(conflict.serviceDate);
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                const formattedDate = language === 'ko'
                  ? `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${days[dateObj.getDay()]})`
                  : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

                return (
                  <TouchableOpacity
                    key={conflict.id}
                    style={[
                      styles.alertItem,
                      index < unresolvedConflicts.length - 1 && [styles.alertItemBorder, { borderBottomColor: colors.borderLight }]
                    ]}
                    onPress={() => handleConflict(conflict)}
                  >
                    <View style={[styles.alertIndicator, { backgroundColor: colors.error }]} />
                    <View style={styles.alertContent}>
                      <Text style={[styles.alertName, { color: colors.textPrimary }]}>
                        {conflict.memberName}
                      </Text>
                      <Text style={[styles.alertDetail, { color: colors.textSecondary }]}>
                        {formattedDate} · {conflict.serviceName} · {conflict.instrumentName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.alertAction, { backgroundColor: colors.error + '15' }]}
                      onPress={() => handleConflict(conflict)}
                    >
                      <Text style={[styles.alertActionText, { color: colors.error }]}>
                        {language === 'ko' ? '처리' : 'Handle'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Pending Responses Section */}
        {pendingMembers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="time" size={18} color={colors.warning} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '응답 대기' : 'Pending Responses'}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.countBadgeText}>{pendingMembers.length}</Text>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                {language === 'ko'
                  ? '참석 가능 여부를 아직 입력하지 않았습니다'
                  : 'Have not submitted availability yet'}
              </Text>
              <TouchableOpacity
                style={[styles.remindAllBtn, { backgroundColor: colors.warning + '15' }]}
                onPress={handleRemindAll}
              >
                <Ionicons name="notifications" size={14} color={colors.warning} />
                <Text style={[styles.remindAllText, { color: colors.warning }]}>
                  {language === 'ko' ? '전체 알림' : 'Remind All'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {pendingMembers.map((member, index) => (
                <View
                  key={member.id}
                  style={[
                    styles.alertItem,
                    index < pendingMembers.length - 1 && [styles.alertItemBorder, { borderBottomColor: colors.borderLight }]
                  ]}
                >
                  <View style={[styles.alertIndicator, { backgroundColor: colors.warning }]} />
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertName, { color: colors.textPrimary }]}>
                      {member.name}
                    </Text>
                    {member.lastReminded && (
                      <Text style={[styles.alertDetail, { color: colors.textMuted }]}>
                        {language === 'ko' ? `마지막 알림: ${member.lastReminded}` : `Last reminded: ${member.lastReminded}`}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.alertAction, { backgroundColor: colors.warning + '15' }]}
                    onPress={() => handleRemindMember(member.id, member.name)}
                  >
                    <Text style={[styles.alertActionText, { color: colors.warning }]}>
                      {language === 'ko' ? '알림' : 'Remind'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {language === 'ko' ? '알림 불러오는 중...' : 'Loading alerts...'}
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && totalAlerts === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '모두 완료!' : 'All Clear!'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {language === 'ko'
                ? '처리할 알림이 없습니다'
                : 'No alerts to handle'}
            </Text>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionDesc: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    marginLeft: 44,
  },
  remindAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  remindAllText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  // Card
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  alertItemBorder: {
    borderBottomWidth: 1,
  },
  alertIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  alertContent: {
    flex: 1,
  },
  alertName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertDetail: {
    fontSize: fontSize.sm,
  },
  alertAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  alertActionText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: fontSize.sm,
  },
  // Loading State
  loadingState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
});
