/**
 * Profile Tab Screen
 *
 * User profile and personal information
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase, getCurrentUser, signOut } from '../../../lib/supabase';
import { useTeamStore } from '../../../store/teamStore';
import { useUserProfileStore, DEFAULT_PARTS } from '../../../store/userProfileStore';
import { useTheme } from '../../../providers/ThemeProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { User } from '../../../types/database.types';
import { spacing, borderRadius, fontSize, lightColors, shadows } from '../../../lib/theme';
import { LABELS } from '../../../lib/constants';
import { useAnalytics } from '../../../lib/analytics';

// Static colors for StyleSheet
const staticColors = lightColors;

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { teams, clearTeams } = useTeamStore();
  const { selectedParts, togglePart, getSelectedPartDetails, getAllParts, addCustomPart, removeCustomPart, customParts, syncPartsToDatabase } = useUserProfileStore();
  const { reset: resetAnalytics, trackLogout } = useAnalytics();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [customPartName, setCustomPartName] = useState('');
  const [customPartEmoji, setCustomPartEmoji] = useState('⭐');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            // Track logout and reset PostHog user identity
            trackLogout();
            resetAnalytics();

            clearTeams();
            await signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="person" size={32} color={colors.primary} />
              </View>
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                <Ionicons name="person" size={32} color={colors.textSecondary} />
              </View>
            )}
          </View>

          <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.full_name || '이름 없음'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>

          <TouchableOpacity style={[styles.editProfileButton, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="pencil" size={16} color={colors.primary} />
            <Text style={[styles.editProfileText, { color: colors.primary }]}>프로필 수정</Text>
          </TouchableOpacity>
        </View>

        {/* My Parts Section - Compact inline design */}
        <TouchableOpacity
          style={[styles.partsSection, { backgroundColor: colors.surface }]}
          onPress={() => setShowPartsModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.partsSectionHeader}>
            <View style={styles.partsSectionLeft}>
              <View style={[styles.partsSectionIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="musical-notes" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.partsSectionTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '내 파트' : 'My Parts'}
              </Text>
            </View>
            <View style={styles.partsSectionRight}>
              {selectedParts.length > 0 ? (
                <View style={styles.partsInlineList}>
                  {getSelectedPartDetails().slice(0, 3).map((part) => (
                    <View
                      key={part.id}
                      style={[styles.partInlineChip, { backgroundColor: colors.primaryLight }]}
                    >
                      <Text style={styles.partInlineEmoji}>{part.emoji}</Text>
                      <Text style={[styles.partInlineName, { color: colors.primary }]}>
                        {language === 'ko' ? part.name : part.nameEn}
                      </Text>
                    </View>
                  ))}
                  {selectedParts.length > 3 && (
                    <Text style={[styles.partsMoreCount, { color: colors.textMuted }]}>
                      +{selectedParts.length - 3}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={[styles.partsEmptyText, { color: colors.primary }]}>
                  {language === 'ko' ? '선택' : 'Select'}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </View>
        </TouchableOpacity>

        {/* My Teams Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>내 팀</Text>

          <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            {teams.map((team, index) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.teamItem,
                  index < teams.length - 1 && [styles.teamItemBorder, { borderBottomColor: colors.borderLight }],
                ]}
                onPress={() => router.push(`/(main)/team/${team.id}`)}
              >
                <View style={styles.teamItemLeft}>
                  <View
                    style={[
                      styles.teamColorDot,
                      { backgroundColor: team.color || colors.primary },
                    ]}
                  />
                  <View>
                    <Text style={[styles.teamName, { color: colors.textPrimary }]}>{team.name}</Text>
                    <Text style={[styles.teamRole, { color: colors.textSecondary }]}>
                      {LABELS.membershipRole[team.membership_role] || team.membership_role}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}

            {teams.length === 0 && (
              <View style={styles.emptyTeams}>
                <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTeamsText, { color: colors.textSecondary }]}>
                  소속된 팀이 없습니다
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.addTeamButton, { borderColor: colors.primary }]}
            onPress={() => router.push('/(auth)/join-group')}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={[styles.addTeamText, { color: colors.primary }]}>팀 추가하기</Text>
          </TouchableOpacity>
        </View>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>PraiseFlow v1.0.0</Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.signOutText, { color: colors.error }]}>
            {language === 'ko' ? '로그아웃' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Parts Selection Modal */}
      <Modal
        visible={showPartsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPartsModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPartsModal(false)}
        >
          <Pressable
            style={[styles.modalContent, styles.partsModalContent, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '내 파트 선택' : 'Select Parts'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {language === 'ko' ? '담당 가능한 파트를 모두 선택해주세요' : 'Select all parts you can do'}
            </Text>

            <ScrollView style={styles.partsModalScroll} showsVerticalScrollIndicator={false}>
              {/* Default Parts */}
              <View style={styles.partsGrid}>
                {DEFAULT_PARTS.map((part) => {
                  const isSelected = selectedParts.includes(part.id);
                  return (
                    <TouchableOpacity
                      key={part.id}
                      style={[
                        styles.partOption,
                        { backgroundColor: isSelected ? colors.primary + '15' : colors.background, borderColor: isSelected ? colors.primary : colors.border },
                      ]}
                      onPress={() => togglePart(part.id)}
                    >
                      <Text style={styles.partOptionEmoji}>{part.emoji}</Text>
                      <Text style={[styles.partOptionName, { color: isSelected ? colors.primary : colors.textPrimary }]}>
                        {language === 'ko' ? part.name : part.nameEn}
                      </Text>
                      {isSelected && (
                        <View style={[styles.partCheck, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Parts */}
              {customParts.length > 0 && (
                <View style={styles.customPartsSection}>
                  <Text style={[styles.customPartsLabel, { color: colors.textSecondary }]}>
                    {language === 'ko' ? '커스텀 파트' : 'Custom Parts'}
                  </Text>
                  <View style={styles.partsGrid}>
                    {customParts.map((part) => {
                      const isSelected = selectedParts.includes(part.id);
                      return (
                        <TouchableOpacity
                          key={part.id}
                          style={[
                            styles.partOption,
                            { backgroundColor: isSelected ? colors.primary + '15' : colors.background, borderColor: isSelected ? colors.primary : colors.border },
                          ]}
                          onPress={() => togglePart(part.id)}
                          onLongPress={() => {
                            Alert.alert(
                              language === 'ko' ? '파트 삭제' : 'Delete Part',
                              language === 'ko' ? `"${part.name}" 파트를 삭제하시겠습니까?` : `Delete "${part.name}" part?`,
                              [
                                { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
                                { text: language === 'ko' ? '삭제' : 'Delete', style: 'destructive', onPress: () => removeCustomPart(part.id) },
                              ]
                            );
                          }}
                        >
                          <Text style={styles.partOptionEmoji}>{part.emoji}</Text>
                          <Text style={[styles.partOptionName, { color: isSelected ? colors.primary : colors.textPrimary }]}>
                            {part.name}
                          </Text>
                          {isSelected && (
                            <View style={[styles.partCheck, { backgroundColor: colors.primary }]}>
                              <Ionicons name="checkmark" size={12} color="#FFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Add Custom Part Button */}
              <TouchableOpacity
                style={[styles.addCustomBtn, { borderColor: colors.primary }]}
                onPress={() => setShowAddCustomModal(true)}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={[styles.addCustomBtnText, { color: colors.primary }]}>
                  {language === 'ko' ? '커스텀 파트 추가' : 'Add Custom Part'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalDoneButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowPartsModal(false);
                // Sync parts to database when done
                syncPartsToDatabase();
              }}
            >
              <Text style={styles.modalDoneButtonText}>
                {language === 'ko' ? '완료' : 'Done'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Custom Part Modal */}
      <Modal
        visible={showAddCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCustomModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddCustomModal(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '커스텀 파트 추가' : 'Add Custom Part'}
            </Text>

            <View style={styles.customPartForm}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '파트 이름' : 'Part Name'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
                value={customPartName}
                onChangeText={setCustomPartName}
                placeholder={language === 'ko' ? '예: 방송팀' : 'e.g., Broadcast'}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '이모지 선택' : 'Select Emoji'}
              </Text>
              <View style={styles.emojiGrid}>
                {['⭐', '🎯', '📱', '💻', '🎨', '📝', '🔧', '🎭', '📺', '🎧', '🎙️', '📡'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      { backgroundColor: customPartEmoji === emoji ? colors.primary + '20' : colors.background, borderColor: customPartEmoji === emoji ? colors.primary : colors.border },
                    ]}
                    onPress={() => setCustomPartEmoji(emoji)}
                  >
                    <Text style={styles.emojiOptionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.customPartActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setShowAddCustomModal(false);
                  setCustomPartName('');
                  setCustomPartEmoji('⭐');
                }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDoneButton, { backgroundColor: customPartName.trim() ? colors.primary : colors.textMuted, flex: 1 }]}
                onPress={() => {
                  if (customPartName.trim()) {
                    addCustomPart(customPartName.trim(), customPartEmoji);
                    setShowAddCustomModal(false);
                    setCustomPartName('');
                    setCustomPartEmoji('⭐');
                    // Sync to database after adding custom part
                    setTimeout(() => syncPartsToDatabase(), 100);
                  }
                }}
                disabled={!customPartName.trim()}
              >
                <Text style={styles.modalDoneButtonText}>
                  {language === 'ko' ? '추가' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
  // Profile Card
  profileCard: {
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: staticColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: staticColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: staticColors.textPrimary,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
    marginBottom: spacing.md,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: staticColors.primaryLight,
  },
  editProfileText: {
    fontSize: fontSize.sm,
    color: staticColors.primary,
    fontWeight: '600',
  },
  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: staticColors.textSecondary,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  // Menu Card
  menuCard: {
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: staticColors.borderLight,
    ...shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: staticColors.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: spacing.md,
  },
  menuItemText: {
    fontSize: fontSize.base,
    color: staticColors.textPrimary,
  },
  // Team Item
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  teamItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: staticColors.borderLight,
  },
  teamItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  teamColorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  teamName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: staticColors.textPrimary,
  },
  teamRole: {
    fontSize: fontSize.xs,
    color: staticColors.textSecondary,
    marginTop: 2,
  },
  emptyTeams: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTeamsText: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
  },
  // Add Team Button
  addTeamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: staticColors.primary,
    borderStyle: 'dashed',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addTeamText: {
    fontSize: fontSize.base,
    color: staticColors.primary,
    fontWeight: '500',
  },
  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: staticColors.surface,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: staticColors.borderLight,
  },
  signOutText: {
    fontSize: fontSize.base,
    color: staticColors.error,
    fontWeight: '500',
  },
  // Settings styles
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuItemValue: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
  },
  versionContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  versionText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: staticColors.textMuted,
  },
  // Modal styles
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
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: staticColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  languageOptionSelected: {
    backgroundColor: staticColors.primaryLight,
  },
  languageOptionContent: {
    flex: 1,
  },
  languageOptionLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: staticColors.textPrimary,
    marginBottom: 2,
  },
  languageOptionSubLabel: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
  },
  modalCloseButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: staticColors.textSecondary,
  },
  // Dev tools styles
  devModeSubtext: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  devBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  devHint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Parts Section - Compact inline design
  partsSection: {
    marginHorizontal: 0,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  partsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partsSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  partsSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partsSectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  partsSectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  partsInlineList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  partInlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  partInlineEmoji: {
    fontSize: 12,
  },
  partInlineName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  partsMoreCount: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  partsEmptyText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  // Parts modal
  partsModalContent: {
    maxHeight: '80%',
  },
  partsModalScroll: {
    maxHeight: 400,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  partsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  partOption: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  partOptionEmoji: {
    fontSize: 18,
  },
  partOptionName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  partCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customPartsSection: {
    marginTop: spacing.md,
  },
  customPartsLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addCustomBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Custom part form
  customPartForm: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  textInput: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    fontSize: fontSize.base,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionText: {
    fontSize: 20,
  },
  customPartActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },
  modalDoneButton: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
