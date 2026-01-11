/**
 * Team Members Screen
 *
 * Shows all team members with their roles and parts
 * Leaders can manage member roles
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '../../../../store/teamStore';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { getTeamMembers, updateMemberRole, removeMember, MemberWithRoles } from '../../../../lib/api/members';
import { spacing, borderRadius, fontSize, shadows } from '../../../../lib/theme';

// Part emoji mapping
const partEmoji: Record<string, string> = {
  leader: '🎤',
  keyboard: '🎹',
  synth: '🎛️',
  drums: '🥁',
  electric: '🎸',
  acoustic: '🪕',
  bass: '🎻',
  vocals: '🎵',
};

// Role display info
const roleInfo: Record<string, { label: string; labelKo: string; color: string }> = {
  owner: { label: 'Owner', labelKo: '오너', color: '#FF6B6B' },
  admin: { label: 'Admin', labelKo: '관리자', color: '#4ECDC4' },
  member: { label: 'Member', labelKo: '멤버', color: '#95A5A6' },
};

export default function TeamMembersScreen() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { activeTeam } = useTeamStore();
  const team = activeTeam();
  const { isAdmin, isOwner } = usePermissions(teamId ?? undefined);
  const isLeader = isAdmin || isOwner;

  const [members, setMembers] = useState<MemberWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberWithRoles | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch team members from API
  useEffect(() => {
    const fetchMembers = async () => {
      if (!teamId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getTeamMembers(teamId);
        setMembers(data);
      } catch (err) {
        console.error('Failed to fetch members:', err);
        setError(err instanceof Error ? err.message : 'Failed to load members');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [teamId]);

  // Filter members by search
  const filteredMembers = members.filter(member =>
    (member.user?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.user?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by role
  const owners = filteredMembers.filter(m => m.membership_role === 'owner');
  const admins = filteredMembers.filter(m => m.membership_role === 'admin');
  const regularMembers = filteredMembers.filter(m => m.membership_role === 'member');

  // Handle member action
  const handleOpenActionMenu = (member: MemberWithRoles) => {
    setSelectedMember(member);
    setShowActionMenu(true);
  };

  // Promote member to admin
  const handlePromoteToAdmin = async () => {
    if (!selectedMember) return;

    setIsUpdating(true);
    try {
      await updateMemberRole(selectedMember.id, 'admin');
      // Refresh members list
      const data = await getTeamMembers(teamId!);
      setMembers(data);
      setShowActionMenu(false);
      setSelectedMember(null);
    } catch (err) {
      console.error('Failed to promote member:', err);
      Alert.alert(
        language === 'ko' ? '오류' : 'Error',
        err instanceof Error ? err.message : (language === 'ko' ? '멤버 승급에 실패했습니다' : 'Failed to promote member')
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Demote admin to member
  const handleDemoteToMember = async () => {
    if (!selectedMember) return;

    setIsUpdating(true);
    try {
      await updateMemberRole(selectedMember.id, 'member');
      // Refresh members list
      const data = await getTeamMembers(teamId!);
      setMembers(data);
      setShowActionMenu(false);
      setSelectedMember(null);
    } catch (err) {
      console.error('Failed to demote member:', err);
      Alert.alert(
        language === 'ko' ? '오류' : 'Error',
        err instanceof Error ? err.message : (language === 'ko' ? '멤버 강등에 실패했습니다' : 'Failed to demote member')
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Remove member from team
  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    Alert.alert(
      language === 'ko' ? '멤버 삭제' : 'Remove Member',
      language === 'ko'
        ? `${selectedMember.user?.full_name || '이 멤버'}를 팀에서 삭제하시겠습니까?`
        : `Are you sure you want to remove ${selectedMember.user?.full_name || 'this member'} from the team?`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '삭제' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await removeMember(selectedMember.id);
              // Refresh members list
              const data = await getTeamMembers(teamId!);
              setMembers(data);
              setShowActionMenu(false);
              setSelectedMember(null);
            } catch (err) {
              console.error('Failed to remove member:', err);
              Alert.alert(
                language === 'ko' ? '오류' : 'Error',
                err instanceof Error ? err.message : (language === 'ko' ? '멤버 삭제에 실패했습니다' : 'Failed to remove member')
              );
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const renderMemberCard = (member: MemberWithRoles) => {
    const role = roleInfo[member.membership_role] || roleInfo.member;
    const memberName = member.user?.full_name || 'Unknown';
    const avatarUrl = member.user?.avatar_url;

    return (
      <View
        key={member.id}
        style={[styles.memberCard, { backgroundColor: colors.surface }]}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {memberName.charAt(0)}
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={[styles.memberName, { color: colors.textPrimary }]}>
              {memberName}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: role.color + '20' }]}>
              <Text style={[styles.roleBadgeText, { color: role.color }]}>
                {language === 'ko' ? role.labelKo : role.label}
              </Text>
            </View>
          </View>

          {/* Parts from member_roles */}
          <View style={styles.partsRow}>
            {member.member_roles?.map(mr => (
              <View key={mr.id} style={[styles.partChip, { backgroundColor: colors.background }]}>
                <Text style={styles.partEmoji}>
                  {mr.role?.icon || partEmoji[mr.role?.name?.toLowerCase() || ''] || '🎵'}
                </Text>
              </View>
            ))}
            {(!member.member_roles || member.member_roles.length === 0) && (
              <Text style={[styles.noPartsText, { color: colors.textMuted }]}>
                {language === 'ko' ? '파트 미설정' : 'No parts'}
              </Text>
            )}
          </View>
        </View>

        {/* Actions for leaders */}
        {isLeader && member.membership_role !== 'owner' && (
          <TouchableOpacity
            style={[styles.moreBtn, { backgroundColor: colors.background }]}
            onPress={() => handleOpenActionMenu(member)}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSection = (title: string, titleKo: string, memberList: MemberWithRoles[]) => {
    if (memberList.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {language === 'ko' ? titleKo : title} ({memberList.length})
        </Text>
        {memberList.map(renderMemberCard)}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {language === 'ko' ? '멤버 로딩 중...' : 'Loading members...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '팀 멤버' : 'Team Members'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {team?.name || 'Team'}
          </Text>
        </View>
        {isLeader && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              router.push(`/(main)/team/${teamId}/invite`);
            }}
          >
            <Ionicons name="person-add" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
        {!isLeader && <View style={styles.headerSpacer} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={[styles.errorCard, { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {members.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {language === 'ko' ? '전체' : 'Total'}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {owners.length + admins.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {language === 'ko' ? '리더' : 'Leaders'}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.info }]}>
              {regularMembers.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {language === 'ko' ? '멤버' : 'Members'}
            </Text>
          </View>
        </View>

        {/* Member Lists */}
        {renderSection('Owners', '오너', owners)}
        {renderSection('Admins', '관리자', admins)}
        {renderSection('Members', '멤버', regularMembers)}

        {filteredMembers.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {language === 'ko' ? '멤버가 없습니다' : 'No members found'}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Action Menu Modal */}
      <Modal
        visible={showActionMenu}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isUpdating) {
            setShowActionMenu(false);
            setSelectedMember(null);
          }
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (!isUpdating) {
              setShowActionMenu(false);
              setSelectedMember(null);
            }
          }}
        >
          <View style={[styles.actionMenuCard, { backgroundColor: colors.surface }]}>
            {isUpdating && (
              <View style={styles.updatingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}

            {/* Member Info */}
            <View style={styles.actionMenuHeader}>
              <View style={[styles.actionMenuAvatar, { backgroundColor: colors.primary + '20' }]}>
                {selectedMember?.user?.avatar_url ? (
                  <Image source={{ uri: selectedMember.user.avatar_url }} style={styles.actionMenuAvatarImage} />
                ) : (
                  <Text style={[styles.actionMenuAvatarText, { color: colors.primary }]}>
                    {(selectedMember?.user?.full_name || 'U').charAt(0)}
                  </Text>
                )}
              </View>
              <View>
                <Text style={[styles.actionMenuName, { color: colors.textPrimary }]}>
                  {selectedMember?.user?.full_name || 'Unknown'}
                </Text>
                <Text style={[styles.actionMenuRole, { color: colors.textSecondary }]}>
                  {selectedMember?.membership_role === 'admin'
                    ? (language === 'ko' ? '관리자' : 'Admin')
                    : (language === 'ko' ? '멤버' : 'Member')}
                </Text>
              </View>
            </View>

            <View style={[styles.actionMenuDivider, { backgroundColor: colors.border }]} />

            {/* Actions */}
            {selectedMember?.membership_role === 'member' && isOwner && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={handlePromoteToAdmin}
                disabled={isUpdating}
              >
                <Ionicons name="arrow-up-circle-outline" size={22} color={colors.success} />
                <Text style={[styles.actionMenuItemText, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '관리자로 승급' : 'Promote to Admin'}
                </Text>
              </TouchableOpacity>
            )}

            {selectedMember?.membership_role === 'admin' && isOwner && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={handleDemoteToMember}
                disabled={isUpdating}
              >
                <Ionicons name="arrow-down-circle-outline" size={22} color={colors.warning} />
                <Text style={[styles.actionMenuItemText, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '멤버로 강등' : 'Demote to Member'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={handleRemoveMember}
              disabled={isUpdating}
            >
              <Ionicons name="person-remove-outline" size={22} color={colors.error} />
              <Text style={[styles.actionMenuItemText, { color: colors.error }]}>
                {language === 'ko' ? '팀에서 삭제' : 'Remove from Team'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.actionMenuDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowActionMenu(false);
                setSelectedMember(null);
              }}
              disabled={isUpdating}
            >
              <Text style={[styles.actionMenuCancelText, { color: colors.textSecondary }]}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  errorCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
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
    marginLeft: -spacing.xs,
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
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
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  memberName: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  partsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  partChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  partEmoji: {
    fontSize: 14,
  },
  noPartsText: {
    fontSize: fontSize.xs,
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  actionMenuCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.lg,
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  actionMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  actionMenuAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMenuAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  actionMenuAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  actionMenuName: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  actionMenuRole: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  actionMenuDivider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  actionMenuItemText: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },
  actionMenuCancelText: {
    fontSize: fontSize.base,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
});
