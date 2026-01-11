/**
 * Members Tab Screen
 *
 * Shows team members list with roles
 * Based on Stitch design (멤버_리스트)
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Share, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTeamStore } from '../../../store/teamStore';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme } from '../../../providers/ThemeProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { getTeamById, TeamWithMembers } from '../../../lib/api/teams';
import { updateMemberRole, removeMember } from '../../../lib/api/members';
import { supabase, getCurrentUserId } from '../../../lib/supabase';
import { spacing, borderRadius, fontSize, shadows, lightColors } from '../../../lib/theme';

// Static colors for StyleSheet (dynamic colors are applied inline)
const staticColors = lightColors;

export default function MembersScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const { activeTeam, activeTeamId } = useTeamStore();
  const team = activeTeam();
  const { isAdmin, isOwner } = usePermissions(activeTeamId ?? undefined);
  const isLeader = isAdmin || isOwner;

  const [teamData, setTeamData] = useState<TeamWithMembers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Member detail modal
  const [selectedMember, setSelectedMember] = useState<TeamWithMembers['members'][0] | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Get current user ID
  useEffect(() => {
    getCurrentUserId().then(setCurrentUserId);
  }, []);

  // Copy invite code to clipboard
  const copyInviteCode = async () => {
    if (team?.invite_code) {
      await Clipboard.setStringAsync(team.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Share invite code
  const shareInviteCode = async () => {
    if (team?.invite_code) {
      const message = language === 'ko'
        ? `${team.name}에 초대합니다!\n\n초대 코드: ${team.invite_code}\n\n앱에서 이 코드를 입력하여 팀에 참여하세요.`
        : `You're invited to join ${team.name}!\n\nInvite Code: ${team.invite_code}\n\nEnter this code in the app to join the team.`;

      try {
        await Share.share({
          message,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const fetchMembers = async () => {
    if (!activeTeamId) return;

    try {
      const data = await getTeamById(activeTeamId);
      setTeamData(data);

      // Fetch pending availability count
      if (isLeader && data?.members) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        // Get users who have submitted availability this month
        const { data: availabilityRecords } = await supabase
          .from('availability')
          .select('user_id')
          .eq('team_id', activeTeamId)
          .gte('date', startOfMonth)
          .lte('date', endOfMonth);

        const submittedUsers = new Set(availabilityRecords?.map(r => r.user_id) || []);
        const pending = data.members.filter(m => !submittedUsers.has(m.user_id)).length;
        setPendingCount(pending);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeTeamId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  // Get role badge color
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'owner':
        return { backgroundColor: colors.warning + '20', color: colors.warning };
      case 'admin':
        return { backgroundColor: colors.primary + '20', color: colors.primary };
      default:
        return { backgroundColor: colors.textMuted + '20', color: colors.textSecondary };
    }
  };

  // Get role label
  const getRoleLabel = (role: string) => {
    if (language === 'en') {
      switch (role) {
        case 'owner': return 'Owner';
        case 'admin': return 'Admin';
        default: return 'Member';
      }
    }
    switch (role) {
      case 'owner': return '관리자';
      case 'admin': return '리더';
      default: return '멤버';
    }
  };

  // Handle member card tap
  const handleMemberTap = (member: TeamWithMembers['members'][0]) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Promote member to admin
  const handlePromoteToAdmin = async () => {
    if (!selectedMember) return;

    Alert.alert(
      language === 'ko' ? '리더로 승급' : 'Promote to Admin',
      language === 'ko'
        ? `${selectedMember.nickname || selectedMember.user?.full_name}님을 리더로 승급하시겠습니까? 리더는 팀 일정을 관리할 수 있습니다.`
        : `Promote ${selectedMember.nickname || selectedMember.user?.full_name} to admin? Admins can manage team schedules.`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '승급' : 'Promote',
          onPress: async () => {
            setIsUpdatingRole(true);
            try {
              await updateMemberRole(selectedMember.id, 'admin');
              await fetchMembers();
              setShowMemberModal(false);
              Alert.alert(
                language === 'ko' ? '완료' : 'Done',
                language === 'ko' ? '리더로 승급되었습니다.' : 'Promoted to admin successfully.'
              );
            } catch (error: any) {
              Alert.alert(
                language === 'ko' ? '오류' : 'Error',
                error.message || (language === 'ko' ? '승급에 실패했습니다.' : 'Failed to promote.')
              );
            } finally {
              setIsUpdatingRole(false);
            }
          },
        },
      ]
    );
  };

  // Demote admin to member
  const handleDemoteToMember = async () => {
    if (!selectedMember) return;

    Alert.alert(
      language === 'ko' ? '멤버로 변경' : 'Demote to Member',
      language === 'ko'
        ? `${selectedMember.nickname || selectedMember.user?.full_name}님을 일반 멤버로 변경하시겠습니까?`
        : `Demote ${selectedMember.nickname || selectedMember.user?.full_name} to regular member?`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '변경' : 'Demote',
          style: 'destructive',
          onPress: async () => {
            setIsUpdatingRole(true);
            try {
              await updateMemberRole(selectedMember.id, 'member');
              await fetchMembers();
              setShowMemberModal(false);
              Alert.alert(
                language === 'ko' ? '완료' : 'Done',
                language === 'ko' ? '멤버로 변경되었습니다.' : 'Demoted to member successfully.'
              );
            } catch (error: any) {
              Alert.alert(
                language === 'ko' ? '오류' : 'Error',
                error.message || (language === 'ko' ? '변경에 실패했습니다.' : 'Failed to demote.')
              );
            } finally {
              setIsUpdatingRole(false);
            }
          },
        },
      ]
    );
  };

  // Remove member from team
  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    Alert.alert(
      language === 'ko' ? '멤버 제거' : 'Remove Member',
      language === 'ko'
        ? `${selectedMember.nickname || selectedMember.user?.full_name}님을 팀에서 제거하시겠습니까?`
        : `Remove ${selectedMember.nickname || selectedMember.user?.full_name} from the team?`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '제거' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsUpdatingRole(true);
            try {
              await removeMember(selectedMember.id);
              await fetchMembers();
              setShowMemberModal(false);
              Alert.alert(
                language === 'ko' ? '완료' : 'Done',
                language === 'ko' ? '멤버가 제거되었습니다.' : 'Member removed successfully.'
              );
            } catch (error: any) {
              Alert.alert(
                language === 'ko' ? '오류' : 'Error',
                error.message || (language === 'ko' ? '제거에 실패했습니다.' : 'Failed to remove.')
              );
            } finally {
              setIsUpdatingRole(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common', 'loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const members = teamData?.members || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Availability Status Card - Leaders Only */}
        {isLeader && (
          <TouchableOpacity
            style={[styles.availabilityCard, { backgroundColor: colors.surface }]}
            onPress={() => router.push(`/(main)/team/${activeTeamId}/availability-status`)}
            activeOpacity={0.7}
          >
            <View style={[styles.availabilityIconContainer, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="time-outline" size={24} color={colors.warning} />
            </View>
            <View style={styles.availabilityContent}>
              <Text style={[styles.availabilityTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '응답 현황' : 'Availability Status'}
              </Text>
              <Text style={[styles.availabilitySubtitle, { color: colors.textSecondary }]}>
                {language === 'ko' ? '팀원 응답 현황 확인 및 독려' : 'Check & remind member responses'}
              </Text>
            </View>
            {pendingCount > 0 && (
              <View style={[styles.availabilityBadge, { backgroundColor: colors.warning + '15' }]}>
                <Text style={[styles.availabilityBadgeText, { color: colors.warning }]}>{pendingCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Member Count */}
        <View style={styles.countSection}>
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {language === 'ko'
              ? `총 ${members.length}명의 멤버`
              : `${members.length} ${t('members', 'membersCount')}`}
          </Text>
          {isLeader && (
            <TouchableOpacity
              style={[styles.inviteButton, { backgroundColor: colors.primaryLight }]}
              onPress={shareInviteCode}
            >
              <Ionicons name="person-add" size={18} color={colors.primary} />
              <Text style={[styles.inviteButtonText, { color: colors.primary }]}>
                {t('members', 'invite')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Members List */}
        {members.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={[styles.memberCard, { backgroundColor: colors.surface }]}
            onPress={() => handleMemberTap(member)}
          >
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: team?.color || colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.textLight }]}>
                {member.user?.full_name?.charAt(0) || member.user?.email?.charAt(0) || '?'}
              </Text>
            </View>

            {/* Member Info */}
            <View style={styles.memberInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                  {member.nickname || member.user?.full_name || member.user?.email || 'Unknown'}
                </Text>
                {member.membership_role === 'owner' && (
                  <Text style={styles.ownerStar}>⭐</Text>
                )}
              </View>

              {/* Roles */}
              <View style={styles.rolesRow}>
                <View style={[
                  styles.roleBadge,
                  { backgroundColor: getRoleBadgeStyle(member.membership_role).backgroundColor }
                ]}>
                  <Text style={[
                    styles.roleBadgeText,
                    { color: getRoleBadgeStyle(member.membership_role).color }
                  ]}>
                    {getRoleLabel(member.membership_role)}
                  </Text>
                </View>

                {/* Musical roles */}
                {member.member_roles?.slice(0, 2).map((mr) => (
                  <View
                    key={mr.id}
                    style={[styles.musicalRoleBadge, { backgroundColor: (mr.role?.color || colors.primary) + '20' }]}
                  >
                    <View style={[styles.roleColorDot, { backgroundColor: mr.role?.color || colors.primary }]} />
                    <Text style={[styles.musicalRoleText, { color: colors.textSecondary }]}>
                      {mr.role?.name || mr.role?.name_ko}
                    </Text>
                  </View>
                ))}
                {(member.member_roles?.length || 0) > 2 && (
                  <Text style={[styles.moreRoles, { color: colors.textMuted }]}>
                    +{member.member_roles!.length - 2}
                  </Text>
                )}
              </View>
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {members.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('members', 'noMembers')}
            </Text>
            {isLeader && (
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                {t('members', 'inviteHint')}
              </Text>
            )}
          </View>
        )}

        {/* Invite Code Section (for leaders) */}
        {isLeader && team?.invite_code && (
          <View style={[styles.inviteCodeSection, { backgroundColor: colors.surface }]}>
            <Text style={[styles.inviteCodeLabel, { color: colors.textSecondary }]}>
              {t('members', 'inviteCode')}
            </Text>
            <View style={[styles.inviteCodeCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.inviteCode, { color: colors.textPrimary }]}>
                {team.invite_code}
              </Text>
              <TouchableOpacity
                style={[
                  styles.copyButton,
                  copied && { backgroundColor: colors.success + '20' }
                ]}
                onPress={copyInviteCode}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={20}
                  color={copied ? colors.success : colors.primary}
                />
              </TouchableOpacity>
            </View>
            {copied && (
              <Text style={[styles.copiedText, { color: colors.success }]}>
                {language === 'ko' ? '복사됨!' : 'Copied!'}
              </Text>
            )}
            <Text style={[styles.inviteCodeHelp, { color: colors.textMuted }]}>
              {t('members', 'shareInviteCode')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Member Detail Modal */}
      <Modal
        visible={showMemberModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '멤버 정보' : 'Member Info'}
              </Text>
              <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <View style={styles.modalBody}>
                {/* Member Info */}
                <View style={styles.modalMemberInfo}>
                  <View style={[styles.modalAvatar, { backgroundColor: team?.color || colors.primary }]}>
                    <Text style={[styles.modalAvatarText, { color: colors.textLight }]}>
                      {selectedMember.user?.full_name?.charAt(0) || selectedMember.user?.email?.charAt(0) || '?'}
                    </Text>
                  </View>
                  <View style={styles.modalMemberDetails}>
                    <Text style={[styles.modalMemberName, { color: colors.textPrimary }]}>
                      {selectedMember.nickname || selectedMember.user?.full_name || selectedMember.user?.email}
                      {selectedMember.membership_role === 'owner' && ' ⭐'}
                    </Text>
                    <View style={[
                      styles.modalRoleBadge,
                      { backgroundColor: getRoleBadgeStyle(selectedMember.membership_role).backgroundColor }
                    ]}>
                      <Text style={[
                        styles.modalRoleBadgeText,
                        { color: getRoleBadgeStyle(selectedMember.membership_role).color }
                      ]}>
                        {getRoleLabel(selectedMember.membership_role)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Role Management Actions - Only for owners */}
                {isOwner && selectedMember.membership_role !== 'owner' && selectedMember.user_id !== currentUserId && (
                  <View style={styles.modalActions}>
                    <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>
                      {language === 'ko' ? '역할 관리' : 'Role Management'}
                    </Text>

                    {selectedMember.membership_role === 'member' && (
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: colors.primary + '15' }]}
                        onPress={handlePromoteToAdmin}
                        disabled={isUpdatingRole}
                      >
                        <Ionicons name="arrow-up-circle-outline" size={20} color={colors.primary} />
                        <Text style={[styles.modalActionText, { color: colors.primary }]}>
                          {language === 'ko' ? '리더로 승급' : 'Promote to Admin'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {selectedMember.membership_role === 'admin' && (
                      <TouchableOpacity
                        style={[styles.modalActionButton, { backgroundColor: colors.warning + '15' }]}
                        onPress={handleDemoteToMember}
                        disabled={isUpdatingRole}
                      >
                        <Ionicons name="arrow-down-circle-outline" size={20} color={colors.warning} />
                        <Text style={[styles.modalActionText, { color: colors.warning }]}>
                          {language === 'ko' ? '멤버로 변경' : 'Demote to Member'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.modalActionButton, { backgroundColor: colors.error + '15' }]}
                      onPress={handleRemoveMember}
                      disabled={isUpdatingRole}
                    >
                      <Ionicons name="person-remove-outline" size={20} color={colors.error} />
                      <Text style={[styles.modalActionText, { color: colors.error }]}>
                        {language === 'ko' ? '팀에서 제거' : 'Remove from Team'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Self or Owner info */}
                {(selectedMember.user_id === currentUserId || selectedMember.membership_role === 'owner') && (
                  <View style={[styles.modalInfoBox, { backgroundColor: colors.primary + '10' }]}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                    <Text style={[styles.modalInfoText, { color: colors.primary }]}>
                      {selectedMember.membership_role === 'owner'
                        ? (language === 'ko' ? '팀 소유자의 역할은 변경할 수 없습니다.' : "Owner's role cannot be changed.")
                        : (language === 'ko' ? '내 역할은 직접 변경할 수 없습니다.' : 'You cannot change your own role.')}
                    </Text>
                  </View>
                )}

                {/* Non-owner admin info */}
                {isAdmin && !isOwner && selectedMember.membership_role !== 'owner' && selectedMember.user_id !== currentUserId && (
                  <View style={[styles.modalInfoBox, { backgroundColor: colors.warning + '10' }]}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                    <Text style={[styles.modalInfoText, { color: colors.warning }]}>
                      {language === 'ko' ? '팀 소유자만 역할을 변경할 수 있습니다.' : 'Only team owner can change roles.'}
                    </Text>
                  </View>
                )}
              </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: fontSize.base,
    color: staticColors.textSecondary,
  },
  countSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  countText: {
    fontSize: fontSize.base,
    color: staticColors.textSecondary,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: staticColors.primaryLight,
    borderRadius: borderRadius.md,
  },
  inviteButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: staticColors.primary,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: staticColors.textLight,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  memberName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: staticColors.textPrimary,
  },
  ownerStar: {
    fontSize: fontSize.sm,
  },
  rolesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  roleBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  musicalRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  roleColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  musicalRoleText: {
    fontSize: fontSize.xs,
    color: staticColors.textSecondary,
  },
  moreRoles: {
    fontSize: fontSize.xs,
    color: staticColors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: staticColors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: staticColors.textMuted,
    marginTop: spacing.xs,
  },
  inviteCodeSection: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  inviteCodeLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: staticColors.textSecondary,
    marginBottom: spacing.sm,
  },
  inviteCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: staticColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  inviteCode: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: staticColors.textPrimary,
    letterSpacing: 2,
  },
  copyButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  inviteCodeHelp: {
    fontSize: fontSize.xs,
    color: staticColors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  copiedText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Availability Status Card
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  availabilityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  availabilityContent: {
    flex: 1,
  },
  availabilityTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  availabilitySubtitle: {
    fontSize: fontSize.xs,
  },
  availabilityBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  availabilityBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: staticColors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: staticColors.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: staticColors.textPrimary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  modalAvatarText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: staticColors.textLight,
  },
  modalMemberDetails: {
    flex: 1,
  },
  modalMemberName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: staticColors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalRoleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  modalRoleBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  modalActions: {
    marginTop: spacing.md,
  },
  modalSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: staticColors.textSecondary,
    marginBottom: spacing.md,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  modalActionText: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },
  modalInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  modalInfoText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
});
