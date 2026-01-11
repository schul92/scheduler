/**
 * Schedule Tab Screen (관리)
 *
 * Shows management tools for team leaders:
 * - Group selection & management
 * - Service types management
 * - Team member management
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Switch, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTeamStore } from '../../../store/teamStore';
import { useServiceTypeStore, ServiceType } from '../../../store/serviceTypeStore';
import { useSchedulingStore } from '../../../store/schedulingStore';
import { useAvailabilityStore } from '../../../store/availabilityStore';
import { useUserProfileStore } from '../../../store/userProfileStore';
import { usePermissions } from '../../../hooks/usePermissions';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../providers/ThemeProvider';
import { useLanguage } from '../../../providers/LanguageProvider';
import { Language } from '../../../store/languageStore';
import { spacing, borderRadius, fontSize, shadows, lightColors } from '../../../lib/theme';

// Static colors for StyleSheet (dynamic colors are applied inline)
const staticColors = lightColors;

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Convert HH:MM string to Date object
const timeToDate = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date;
};

// Convert Date to HH:MM string
const dateToTime = (date: Date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// Format time for display with AM/PM
const formatTimeDisplay = (time: string, lang: 'ko' | 'en') => {
  const [h, m] = time.split(':').map(Number);
  const isAM = h < 12;
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (lang === 'ko') {
    return `${isAM ? '오전' : '오후'} ${hour}:${m.toString().padStart(2, '0')}`;
  }
  return `${hour}:${m.toString().padStart(2, '0')} ${isAM ? 'AM' : 'PM'}`;
};

export default function ScheduleScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const days = language === 'ko' ? DAYS_KO : DAYS_EN;
  const { activeTeamId, activeTeam } = useTeamStore();
  const team = activeTeam();
  const { isAdmin, isOwner } = usePermissions(activeTeamId ?? undefined);
  const isLeader = isAdmin || isOwner;

  // Service types management
  const {
    getServiceTypes,
    addServiceType,
    updateServiceType,
    deleteServiceType,
  } = useServiceTypeStore();

  const serviceTypes = getServiceTypes(activeTeamId || '');

  // Note: Service types should be created by the leader during onboarding
  // (service-setup screen), not auto-initialized here

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<ServiceType | null>(null);
  const [typeName, setTypeName] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | undefined>(0);
  const [serviceTime, setServiceTime] = useState('11:00');
  const [rehearsalTime, setRehearsalTime] = useState('10:00');

  // Time picker state
  const [showServiceTimePicker, setShowServiceTimePicker] = useState(false);
  const [showRehearsalTimePicker, setShowRehearsalTimePicker] = useState(false);

  // Language modal state
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const languageOptions: { code: Language; label: string; nativeLabel: string }[] = [
    { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
    { code: 'en', label: 'English', nativeLabel: 'English' },
  ];
  const currentLanguageLabel = language === 'ko' ? '한국어' : 'English';

  // Logout handler (simple sign out without wiping data)
  const handleLogout = () => {
    Alert.alert(
      language === 'ko' ? '로그아웃' : 'Sign Out',
      language === 'ko'
        ? '로그아웃 하시겠습니까?'
        : 'Are you sure you want to sign out?',
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '로그아웃' : 'Sign Out',
          onPress: async () => {
            try {
              // Sign out from Supabase
              await supabase.auth.signOut();
              // Navigate to welcome screen
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const openAddModal = () => {
    setEditingType(null);
    setTypeName('');
    setSelectedDay(0);
    setServiceTime('11:00');
    setRehearsalTime('10:00');
    setShowModal(true);
  };

  const openEditModal = (type: ServiceType) => {
    setEditingType(type);
    setTypeName(type.name);
    setSelectedDay(type.defaultDay);
    setServiceTime(type.serviceTime || '11:00');
    setRehearsalTime(type.rehearsalTime || '10:00');
    setShowModal(true);
  };

  const handleSave = () => {
    if (!typeName.trim()) {
      Alert.alert(
        language === 'ko' ? '오류' : 'Error',
        language === 'ko' ? '예배 이름을 입력해주세요' : 'Please enter a service name'
      );
      return;
    }

    if (editingType) {
      updateServiceType(activeTeamId || '', editingType.id, {
        name: typeName.trim(),
        defaultDay: selectedDay,
        serviceTime,
        rehearsalTime,
      });
    } else {
      addServiceType(activeTeamId || '', typeName.trim(), selectedDay, serviceTime, rehearsalTime);
    }

    setShowModal(false);
  };

  const handleDelete = (type: ServiceType) => {
    Alert.alert(
      language === 'ko' ? '삭제 확인' : 'Confirm Delete',
      language === 'ko'
        ? `"${type.name}"을(를) 삭제하시겠습니까?`
        : `Delete "${type.name}"?`,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '삭제' : 'Delete',
          style: 'destructive',
          onPress: () => deleteServiceType(activeTeamId || '', type.id),
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
        {/* Group Selection */}
        <View style={styles.section}>
          {/* Current Group Selector */}
          <View style={[styles.groupSelectorCard, { backgroundColor: colors.surface, borderColor: colors.primary + '20' }]}>
            <Text style={[styles.groupSelectorLabel, { color: colors.textSecondary }]}>
              {t('management', 'currentGroup')}
            </Text>
            <TouchableOpacity
              style={[styles.groupSelector, { backgroundColor: colors.background, borderColor: colors.primary + '30' }]}
              onPress={() => {
                // TODO: Show group selector modal
              }}
            >
              <View style={styles.groupSelectorContent}>
                <View style={[styles.groupColorDot, { backgroundColor: team?.color || colors.primary }]} />
                <Text style={[styles.groupName, { color: colors.textPrimary }]}>
                  {team?.name || t('management', 'selectGroup')}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Group Actions */}
          <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.borderLight }]}
              onPress={() => router.push('/(auth)/join-group')}
            >
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                {t('management', 'createGroup')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(auth)/join-group')}
            >
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>
                {t('management', 'joinGroup')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Types (Leaders only) */}
        {isLeader && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {language === 'ko' ? '예배/모임' : 'Gatherings'}
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={openAddModal}
              >
                <Ionicons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Service Type List */}
            <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
              {serviceTypes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="musical-notes-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {language === 'ko' ? '등록된 예배/모임이 없습니다' : 'No gatherings yet'}
                  </Text>
                </View>
              ) : (
                serviceTypes.map((type, index) => (
                  <View
                    key={type.id}
                    style={[
                      styles.typeItem,
                      index < serviceTypes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={styles.typeInfo}>
                      <Text style={[styles.typeName, { color: colors.textPrimary }]}>
                        {type.name}
                      </Text>
                      <View style={styles.typeMeta}>
                        {type.defaultDay !== undefined && (
                          <View style={[styles.typeTag, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.typeTagText, { color: colors.primary }]}>
                              {days[type.defaultDay]}
                            </Text>
                          </View>
                        )}
                        {type.serviceTime && (
                          <Text style={[styles.typeTime, { color: colors.textMuted }]}>
                            {type.serviceTime}
                          </Text>
                        )}
                        {type.rehearsalTime && (
                          <Text style={[styles.typeTime, { color: colors.textMuted }]}>
                            ({language === 'ko' ? '연습' : 'Reh'} {type.rehearsalTime})
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.typeActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.background }]}
                        onPress={() => openEditModal(type)}
                      >
                        <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.background }]}
                        onPress={() => handleDelete(type)}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {language === 'ko' ? '설정' : 'Settings'}
          </Text>

          <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            {/* Dark Mode Toggle */}
            <View style={[styles.settingsItem, styles.settingsItemBorder, { borderBottomColor: colors.borderLight }]}>
              <View style={styles.settingsItemLeft}>
                <Ionicons
                  name={isDark ? "moon" : "moon-outline"}
                  size={20}
                  color={colors.textPrimary}
                  style={styles.settingsIcon}
                />
                <Text style={[styles.settingsItemText, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '다크 모드' : 'Dark Mode'}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{
                  false: isDark ? '#555' : '#E5E7EB',
                  true: colors.primary
                }}
                thumbColor={'#FFFFFF'}
                ios_backgroundColor={isDark ? '#555' : '#E5E7EB'}
              />
            </View>

            {/* Notifications */}
            <TouchableOpacity
              style={[styles.settingsItem, styles.settingsItemBorder, { borderBottomColor: colors.borderLight }]}
              onPress={() => {
                Alert.alert(
                  language === 'ko' ? '알림 설정' : 'Notifications',
                  language === 'ko' ? '준비 중입니다' : 'Coming soon'
                );
              }}
            >
              <View style={styles.settingsItemLeft}>
                <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} style={styles.settingsIcon} />
                <Text style={[styles.settingsItemText, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '알림 설정' : 'Notifications'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Language Selector */}
            <TouchableOpacity
              style={[styles.settingsItem, styles.settingsItemBorder, { borderBottomColor: colors.borderLight }]}
              onPress={() => setShowLanguageModal(true)}
            >
              <View style={styles.settingsItemLeft}>
                <Text style={[styles.settingsIcon, { fontSize: 18, color: colors.textPrimary }]}>文A</Text>
                <Text style={[styles.settingsItemText, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '언어' : 'Language'}
                </Text>
              </View>
              <View style={styles.settingsItemRight}>
                <Text style={[styles.settingsItemValue, { color: colors.textSecondary }]}>
                  {currentLanguageLabel}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>

            {/* Help */}
            <TouchableOpacity
              style={[styles.settingsItem, styles.settingsItemBorder, { borderBottomColor: colors.borderLight }]}
              onPress={() => {
                Alert.alert(
                  language === 'ko' ? '도움말' : 'Help',
                  language === 'ko'
                    ? '문의사항이 있으시면 zoestudiollc@gmail.com으로 연락주세요.'
                    : 'For questions, please contact zoestudiollc@gmail.com'
                );
              }}
            >
              <View style={styles.settingsItemLeft}>
                <Ionicons name="help-circle-outline" size={20} color={colors.textPrimary} style={styles.settingsIcon} />
                <Text style={[styles.settingsItemText, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '도움말' : 'Help'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Terms */}
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                Alert.alert(
                  language === 'ko' ? '이용약관' : 'Terms of Service',
                  language === 'ko'
                    ? '본 앱을 사용함으로써 귀하는 Zoe Studio LLC의 서비스 약관에 동의하게 됩니다. 자세한 내용은 웹사이트를 참조하세요.'
                    : 'By using this app, you agree to the Terms of Service of Zoe Studio LLC. Please visit our website for more details.'
                );
              }}
            >
              <View style={styles.settingsItemLeft}>
                <Ionicons name="document-text-outline" size={20} color={colors.textPrimary} style={styles.settingsIcon} />
                <Text style={[styles.settingsItemText, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '이용약관' : 'Terms of Service'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.logoutButtonText, { color: colors.textPrimary }]}>
              {language === 'ko' ? '로그아웃' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Copyright */}
        <View style={styles.copyrightContainer}>
          <Text style={[styles.copyrightText, { color: colors.textMuted }]}>
            © 2026 Zoe Studio LLC. All rights reserved.
          </Text>
        </View>

      </ScrollView>

      {/* Add/Edit Service Type Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingType
                  ? (language === 'ko' ? '모임 수정' : 'Edit Gathering')
                  : (language === 'ko' ? '모임 추가' : 'Add Gathering')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '모임 이름' : 'Gathering Name'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder={language === 'ko' ? '예: 주일예배 2부' : 'e.g., Sunday Service'}
                placeholderTextColor={colors.textMuted}
                value={typeName}
                onChangeText={setTypeName}
              />
            </View>

            {/* Default Day Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '기본 요일' : 'Default Day'}
              </Text>
              <View style={styles.dayRow}>
                {days.map((day, i) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayBtn,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      selectedDay === i && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setSelectedDay(i)}
                  >
                    <Text style={[
                      styles.dayBtnText,
                      { color: colors.textPrimary },
                      selectedDay === i && { color: '#FFF' },
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Service Time Picker */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '예배시간' : 'Service Time'}
              </Text>
              <TouchableOpacity
                style={[styles.timePickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowServiceTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={[styles.timePickerText, { color: colors.textPrimary }]}>
                  {formatTimeDisplay(serviceTime, language)}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Rehearsal Time Picker */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '연습시간' : 'Rehearsal Time'}
              </Text>
              <TouchableOpacity
                style={[styles.timePickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowRehearsalTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={colors.info} />
                <Text style={[styles.timePickerText, { color: colors.textPrimary }]}>
                  {formatTimeDisplay(rehearsalTime, language)}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Native Time Pickers */}
            <DateTimePickerModal
              isVisible={showServiceTimePicker}
              mode="time"
              date={timeToDate(serviceTime)}
              onConfirm={(date) => {
                setServiceTime(dateToTime(date));
                setShowServiceTimePicker(false);
              }}
              onCancel={() => setShowServiceTimePicker(false)}
              locale={language === 'ko' ? 'ko_KR' : 'en_US'}
              confirmTextIOS={language === 'ko' ? '확인' : 'Confirm'}
              cancelTextIOS={language === 'ko' ? '취소' : 'Cancel'}
              isDarkModeEnabled={isDark}
              themeVariant={isDark ? 'dark' : 'light'}
              display="spinner"
            />
            <DateTimePickerModal
              isVisible={showRehearsalTimePicker}
              mode="time"
              date={timeToDate(rehearsalTime)}
              onConfirm={(date) => {
                setRehearsalTime(dateToTime(date));
                setShowRehearsalTimePicker(false);
              }}
              onCancel={() => setShowRehearsalTimePicker(false)}
              locale={language === 'ko' ? 'ko_KR' : 'en_US'}
              confirmTextIOS={language === 'ko' ? '확인' : 'Confirm'}
              cancelTextIOS={language === 'ko' ? '취소' : 'Cancel'}
              isDarkModeEnabled={isDark}
              themeVariant={isDark ? 'dark' : 'light'}
              display="spinner"
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>
                  {language === 'ko' ? '저장' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable
          style={styles.languageModalOverlay}
          onPress={() => setShowLanguageModal(false)}
        >
          <Pressable
            style={[styles.languageModalContent, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.languageModalTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '언어' : 'Language'}
            </Text>

            {languageOptions.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.languageOption,
                  language === option.code && [styles.languageOptionSelected, { backgroundColor: colors.primaryLight }],
                ]}
                onPress={() => {
                  setLanguage(option.code);
                  setShowLanguageModal(false);
                }}
              >
                <View style={styles.languageOptionContent}>
                  <Text style={[styles.languageOptionLabel, { color: colors.textPrimary }]}>
                    {option.nativeLabel}
                  </Text>
                  <Text style={[styles.languageOptionSubLabel, { color: colors.textSecondary }]}>
                    {option.label}
                  </Text>
                </View>
                {language === option.code && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.languageModalCloseButton, { backgroundColor: colors.background }]}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={[styles.languageModalCloseButtonText, { color: colors.textSecondary }]}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Text>
            </TouchableOpacity>
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
    paddingBottom: 100,
  },
  // Section
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: staticColors.textSecondary,
    marginLeft: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    marginLeft: spacing.xs,
  },
  // Group Selector Card
  groupSelectorCard: {
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: staticColors.primary + '10',
    ...shadows.sm,
  },
  groupSelectorLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: staticColors.textSecondary,
    marginBottom: spacing.sm,
  },
  groupSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: staticColors.background,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: staticColors.primary + '20',
  },
  groupSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  groupColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  groupName: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: staticColors.textPrimary,
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
  menuItemText: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: staticColors.textPrimary,
  },
  // Service Types
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  typeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  typeTime: {
    fontSize: fontSize.xs,
  },
  typeActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
  },
  timePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  timePickerText: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  saveBtn: {},
  saveBtnText: {
    color: '#FFF',
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  // Settings styles
  settingsCard: {
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: staticColors.borderLight,
    ...shadows.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: staticColors.borderLight,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    marginRight: spacing.md,
    width: 24,
    textAlign: 'center',
  },
  settingsItemText: {
    fontSize: fontSize.base,
    color: staticColors.textPrimary,
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsItemValue: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
  },
  // Language Modal styles
  languageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  languageModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  languageModalTitle: {
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
  languageModalCloseButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  languageModalCloseButtonText: {
    fontSize: fontSize.base,
    fontWeight: '500',
    color: staticColors.textSecondary,
  },
  // Logout button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  logoutButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Copyright
  copyrightContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: fontSize.xs,
    color: staticColors.textMuted,
  },
});
