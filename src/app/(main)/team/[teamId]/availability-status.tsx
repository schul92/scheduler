/**
 * Availability Request Status Screen
 *
 * Shows team member availability response status
 * Based on Stitch design (가용일 요청 현황)
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { useTeamStore } from '../../../../store/teamStore';
import { supabase } from '../../../../lib/supabase';
import { spacing, borderRadius, fontSize, lightColors, shadows } from '../../../../lib/theme';

const staticColors = lightColors;

// Member type for availability status
interface MemberStatus {
  id: string;
  name: string;
  role: string;
  status: 'pending' | 'completed';
  lastActivity?: string;
  avatar: string | null;
}

type FilterType = 'all' | 'completed' | 'pending';

export default function AvailabilityStatusScreen() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const { activeTeam } = useTeamStore();
  const team = activeTeam();

  const [filter, setFilter] = useState<FilterType>('all');
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalState, setModalState] = useState<'confirm' | 'success'>('confirm');

  // Fetch team members and their availability status
  useEffect(() => {
    const fetchMembersStatus = async () => {
      if (!teamId) return;

      setIsLoading(true);
      try {
        // Fetch team members with their user info
        const { data: teamMembers, error: membersError } = await supabase
          .from('team_members')
          .select(`
            id,
            user_id,
            nickname,
            parts,
            users:user_id (full_name, avatar_url)
          `)
          .eq('team_id', teamId)
          .eq('status', 'active');

        if (membersError) {
          console.error('Error fetching members:', membersError);
          return;
        }

        // Get current month date range for availability check
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        // Fetch availability records for this month
        const { data: availabilityRecords, error: availError } = await supabase
          .from('availability')
          .select('user_id, updated_at')
          .eq('team_id', teamId)
          .gte('date', startOfMonth)
          .lte('date', endOfMonth);

        if (availError) {
          console.error('Error fetching availability:', availError);
        }

        // Create a map of user_id -> has submitted availability
        const submittedUsers = new Set(availabilityRecords?.map(r => r.user_id) || []);
        const lastActivityMap = new Map<string, string>();
        availabilityRecords?.forEach(r => {
          const existing = lastActivityMap.get(r.user_id);
          if (!existing || r.updated_at > existing) {
            lastActivityMap.set(r.user_id, r.updated_at);
          }
        });

        // Transform to MemberStatus format
        const memberStatuses: MemberStatus[] = (teamMembers || []).map((m: any) => {
          const hasSubmitted = submittedUsers.has(m.user_id);
          const lastActivity = lastActivityMap.get(m.user_id);

          let activityText = language === 'ko' ? '미응답' : 'No response';
          if (lastActivity) {
            const date = new Date(lastActivity);
            activityText = `${date.getMonth() + 1}.${date.getDate()} ${language === 'ko' ? '제출' : 'submitted'}`;
          }

          return {
            id: m.id,
            name: m.nickname || m.users?.full_name || 'Unknown',
            role: Array.isArray(m.parts) && m.parts.length > 0 ? m.parts[0] : '',
            status: hasSubmitted ? 'completed' : 'pending',
            lastActivity: activityText,
            avatar: m.users?.avatar_url || null,
          };
        });

        setMembers(memberStatuses);
      } catch (err) {
        console.error('Error fetching member status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembersStatus();
  }, [teamId, language]);

  const pendingMembers = members.filter(m => m.status === 'pending');
  const completedMembers = members.filter(m => m.status === 'completed');

  const filteredMembers = filter === 'all'
    ? members
    : filter === 'pending'
      ? pendingMembers
      : completedMembers;

  const handleSendReminder = () => {
    setModalState('confirm');
    setShowModal(true);
  };

  const confirmSendReminder = () => {
    // TODO: Send push notification to pending members
    console.log('Sending reminder to', pendingMembers.length, 'members');
    setModalState('success');

    // Auto close after 1.5 seconds
    setTimeout(() => {
      setShowModal(false);
      setModalState('confirm');
    }, 1500);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(main)/(tabs)/members')}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '응답 현황' : 'Response Status'}
          </Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {language === 'ko' ? '로딩 중...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(main)/(tabs)/members')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {language === 'ko' ? '응답 현황' : 'Response Status'}
        </Text>
        <TouchableOpacity style={styles.headerButton}>
          <Text style={[styles.headerButtonText, { color: colors.textSecondary }]}>
            {language === 'ko' ? '재알림' : 'Remind'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Request Info */}
        <View style={styles.requestInfo}>
          <View style={[styles.teamBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.teamDot, { backgroundColor: team?.color || colors.primary }]} />
            <Text style={[styles.teamBadgeText, { color: colors.textPrimary }]}>
              {team?.name || '찬양팀'}
            </Text>
          </View>
          <Text style={[styles.requestTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '가용일 응답 현황' : 'Availability Response Status'}
          </Text>
          <View style={styles.deadlineRow}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.deadlineText, { color: colors.textSecondary }]}>
              {language === 'ko' ? `총 ${members.length}명의 팀원` : `${members.length} team members`}
            </Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {language === 'ko' ? '총 팀원' : 'Total'}
            </Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {members.length}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statLabelRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '응답 완료' : 'Completed'}
              </Text>
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {completedMembers.length}
            </Text>
          </View>
          <View style={[styles.statCardDanger, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
            <View style={styles.statLabelRow}>
              <View style={[styles.statusDotPulse, { backgroundColor: colors.error }]} />
              <Text style={[styles.statLabel, { color: colors.error }]}>
                {language === 'ko' ? '미응답' : 'Pending'}
              </Text>
            </View>
            <Text style={[styles.statValue, { color: colors.error }]}>
              {pendingMembers.length}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.filterTabs, { backgroundColor: isDark ? colors.surface : '#EBEAE5' }]}>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filter === 'all' && [styles.filterTabActive, { backgroundColor: colors.surface }],
            ]}
            onPress={() => setFilter('all')}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: colors.textSecondary },
                filter === 'all' && { color: colors.textPrimary, fontWeight: '700' },
              ]}
            >
              {language === 'ko' ? `전체 ${members.length}` : `All ${members.length}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filter === 'completed' && [styles.filterTabActive, { backgroundColor: colors.surface }],
            ]}
            onPress={() => setFilter('completed')}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: colors.textSecondary },
                filter === 'completed' && { color: colors.textPrimary, fontWeight: '700' },
              ]}
            >
              {language === 'ko' ? `완료 ${completedMembers.length}` : `Done ${completedMembers.length}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              filter === 'pending' && [styles.filterTabActive, { backgroundColor: colors.surface }],
            ]}
            onPress={() => setFilter('pending')}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: colors.textSecondary },
                filter === 'pending' && { color: colors.error, fontWeight: '700' },
              ]}
            >
              {language === 'ko' ? `미응답 ${pendingMembers.length}` : `Pending ${pendingMembers.length}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Member List */}
        <View style={styles.memberList}>
          {filter === 'all' && pendingMembers.length > 0 && (
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {language === 'ko' ? '요청 대기중' : 'Awaiting Response'}
            </Text>
          )}

          {/* Pending Members */}
          {(filter === 'all' || filter === 'pending') && pendingMembers.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.memberCard,
                styles.memberCardPending,
                { backgroundColor: colors.surface, borderColor: colors.error + '30' },
              ]}
            >
              <View style={[styles.memberCardAccent, { backgroundColor: colors.error }]} />
              <View style={styles.memberContent}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatar, { backgroundColor: colors.border }]}>
                    <Ionicons name="person" size={20} color={colors.textMuted} />
                  </View>
                  <View style={[styles.statusIcon, { backgroundColor: colors.surface }]}>
                    <Ionicons name="alert-circle" size={14} color={colors.error} />
                  </View>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                    {member.name}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                    {member.role}
                  </Text>
                </View>
                <View style={styles.memberStatus}>
                  <Text style={[styles.statusText, { color: colors.error }]}>
                    {language === 'ko' ? '미응답' : 'Pending'}
                  </Text>
                  <Text style={[styles.statusSubtext, { color: colors.textMuted }]}>
                    {member.lastActivity}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Divider */}
          {filter === 'all' && completedMembers.length > 0 && pendingMembers.length > 0 && (
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                {language === 'ko' ? `응답 완료 ${completedMembers.length}명` : `Completed ${completedMembers.length}`}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          )}

          {/* Completed Members */}
          {(filter === 'all' || filter === 'completed') && completedMembers.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.memberCard,
                styles.memberCardCompleted,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.memberContent}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatar, styles.avatarCompleted, { backgroundColor: colors.border }]}>
                    <Ionicons name="person" size={20} color={colors.textMuted} />
                  </View>
                  <View style={[styles.statusIcon, { backgroundColor: colors.surface }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  </View>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, styles.memberNameCompleted, { color: colors.textPrimary }]}>
                    {member.name}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.textSecondary }]}>
                    {member.role}
                  </Text>
                </View>
                <View style={styles.memberStatus}>
                  <Text style={[styles.statusText, { color: colors.success }]}>
                    {language === 'ko' ? '완료' : 'Done'}
                  </Text>
                  <Text style={[styles.statusSubtext, { color: colors.textMuted }]}>
                    {member.lastActivity}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {members.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {language === 'ko' ? '팀원이 없습니다' : 'No team members'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom CTA */}
      {pendingMembers.length > 0 && (
        <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.reminderButton, { backgroundColor: colors.primary }]}
            onPress={handleSendReminder}
          >
            <Ionicons name="notifications" size={20} color="#FFFFFF" />
            <Text style={styles.reminderButtonText}>
              {language === 'ko'
                ? `미응답 팀원에게 알림 보내기 (${pendingMembers.length}명)`
                : `Send Reminder to ${pendingMembers.length} Members`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {modalState === 'confirm' ? (
              <>
                <View style={[styles.modalIconContainer, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="notifications" size={32} color={colors.primary} />
                </View>

                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '알림을 보내시겠습니까?' : 'Send Reminder?'}
                </Text>

                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {language === 'ko'
                    ? `${pendingMembers.length}명의 미응답 팀원에게 푸시 알림이 발송됩니다.`
                    : `Push notification will be sent to ${pendingMembers.length} pending members.`}
                </Text>

                <View style={[styles.memberPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {pendingMembers.slice(0, 3).map((member) => (
                    <View key={member.id} style={styles.memberPreviewItem}>
                      <View style={[styles.memberPreviewAvatar, { backgroundColor: colors.border }]}>
                        <Ionicons name="person" size={14} color={colors.textMuted} />
                      </View>
                      <Text style={[styles.memberPreviewName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {member.name}
                      </Text>
                    </View>
                  ))}
                  {pendingMembers.length > 3 && (
                    <Text style={[styles.memberPreviewMore, { color: colors.textSecondary }]}>
                      {language === 'ko' ? `외 ${pendingMembers.length - 3}명` : `+${pendingMembers.length - 3} more`}
                    </Text>
                  )}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: colors.border }]}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                      {language === 'ko' ? '취소' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary }]}
                    onPress={confirmSendReminder}
                  >
                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                      {language === 'ko' ? '보내기' : 'Send'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.modalIconContainer, styles.modalIconSuccess, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                </View>

                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '알림 발송 완료!' : 'Reminder Sent!'}
                </Text>

                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {language === 'ko'
                    ? `${pendingMembers.length}명에게 알림이 발송되었습니다.`
                    : `Notification sent to ${pendingMembers.length} members.`}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  requestInfo: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  requestTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  deadlineText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  statCardDanger: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  filterTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  filterTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  memberList: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  memberCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  memberCardPending: {
    position: 'relative',
  },
  memberCardCompleted: {
    opacity: 0.7,
  },
  memberCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.lg,
  },
  memberContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingLeft: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCompleted: {
    opacity: 0.6,
  },
  statusIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 10,
    padding: 1,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  memberNameCompleted: {
    fontWeight: '500',
  },
  memberRole: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  memberStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statusSubtext: {
    fontSize: 10,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 120,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    borderRadius: borderRadius.lg,
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalIconSuccess: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  memberPreview: {
    width: '100%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  memberPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  memberPreviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  memberPreviewName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  memberPreviewMore: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: borderRadius.lg,
  },
  modalButtonSecondary: {
    borderWidth: 1,
  },
  modalButtonPrimary: {
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
});
