/**
 * Team Settings Screen
 *
 * Configure team settings including:
 * - Service types (세부 그룹)
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useServiceTypeStore, ServiceType } from '../../../../store/serviceTypeStore';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { spacing, borderRadius, fontSize, shadows } from '../../../../lib/theme';

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

export default function TeamSettingsScreen() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const days = language === 'ko' ? DAYS_KO : DAYS_EN;

  const {
    getServiceTypes,
    addServiceType,
    updateServiceType,
    deleteServiceType,
  } = useServiceTypeStore();

  const serviceTypes = getServiceTypes(teamId || '');

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
        language === 'ko' ? '모임 이름을 입력해주세요' : 'Please enter a gathering name'
      );
      return;
    }

    // Check for duplicate names (excluding current item if editing)
    const isDuplicate = serviceTypes.some(
      (t) =>
        t.name.toLowerCase() === typeName.trim().toLowerCase() &&
        (!editingType || t.id !== editingType.id)
    );

    if (isDuplicate) {
      Alert.alert(
        language === 'ko' ? '중복된 이름' : 'Duplicate Name',
        language === 'ko'
          ? `"${typeName.trim()}" 모임이 이미 등록되어 있습니다`
          : `A gathering named "${typeName.trim()}" already exists`
      );
      return;
    }

    if (editingType) {
      updateServiceType(teamId || '', editingType.id, {
        name: typeName.trim(),
        defaultDay: selectedDay,
        serviceTime,
        rehearsalTime,
      });
    } else {
      addServiceType(teamId || '', typeName.trim(), selectedDay, serviceTime, rehearsalTime);
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
          onPress: () => deleteServiceType(teamId || '', type.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {language === 'ko' ? '팀 설정' : 'Team Settings'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Service Types Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '예배/모임' : 'Gatherings'}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {language === 'ko' ? '팀에서 정기적으로 모이는 일정을 등록하세요' : 'Set up the gatherings your team regularly has'}
              </Text>
            </View>
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
                      {type.isPrimary && (
                        <View style={[styles.typeTag, { backgroundColor: colors.success + '15' }]}>
                          <Text style={[styles.typeTagText, { color: colors.success }]}>
                            {language === 'ko' ? '기본' : 'Primary'}
                          </Text>
                        </View>
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

        {/* More sections can be added here */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add/Edit Modal */}
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
                placeholder={language === 'ko' ? '예: 주일 2부, 토요모임' : 'e.g., Sunday 2nd, Saturday Gathering'}
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
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
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
  bottomSpacer: {
    height: 100,
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
});
