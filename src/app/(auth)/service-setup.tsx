/**
 * Service Setup Screen
 *
 * Multi-step wizard for setting up service types during onboarding
 * Handles: recurring vs manual services, rehearsal on different days
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTeamStore } from '../../store/teamStore';
import {
  useServiceTypeStore,
  ScheduleType,
  RehearsalType,
} from '../../store/serviceTypeStore';
import { useTheme } from '../../providers/ThemeProvider';
import { useLanguage } from '../../providers/LanguageProvider';
import { colors, spacing, borderRadius, fontSize, shadows } from '../../lib/theme';

type Step = 'pattern' | 'services' | 'complete';

interface ServiceDraft {
  id: string;
  name: string;
  scheduleType: ScheduleType;
  defaultDay: number;
  serviceTime: string;
  rehearsalType: RehearsalType;
  rehearsalDay: number;
  rehearsalTime: string;
  rehearsalDaysBefore: number;
}

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

export default function ServiceSetupScreen() {
  const router = useRouter();
  const { colors: themeColors, isDark } = useTheme();
  const { language } = useLanguage();
  const { activeTeamId } = useTeamStore();
  const { addServiceTypeFull, clearTeamServiceTypes } = useServiceTypeStore();

  const days = language === 'ko' ? DAYS_KO : DAYS_EN;

  // Wizard state
  const [step, setStep] = useState<Step>('pattern');
  const [schedulePattern, setSchedulePattern] = useState<'recurring' | 'manual' | 'both' | null>(null);

  // Services being configured
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state for current service
  const [serviceName, setServiceName] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [serviceTime, setServiceTime] = useState('11:00');
  const [rehearsalType, setRehearsalType] = useState<RehearsalType>('same_day');
  const [rehearsalDay, setRehearsalDay] = useState(4); // Thursday
  const [rehearsalTime, setRehearsalTime] = useState('20:00');

  // Time picker state
  const [showServiceTimePicker, setShowServiceTimePicker] = useState(false);
  const [showRehearsalTimePicker, setShowRehearsalTimePicker] = useState(false);

  // Reset form
  const resetForm = () => {
    setServiceName('');
    setSelectedDay(0);
    setServiceTime('11:00');
    setRehearsalType('same_day');
    setRehearsalDay(4);
    setRehearsalTime('20:00');
    setEditingIndex(null);
  };

  // Add or update service
  const handleSaveService = () => {
    if (!serviceName.trim()) {
      Alert.alert(
        language === 'ko' ? '오류' : 'Error',
        language === 'ko' ? '예배/모임 이름을 입력해주세요' : 'Please enter a name'
      );
      return;
    }

    const newService: ServiceDraft = {
      id: editingIndex !== null ? services[editingIndex].id : `draft_${Date.now()}`,
      name: serviceName.trim(),
      scheduleType: schedulePattern === 'manual' ? 'manual' : 'recurring',
      defaultDay: selectedDay,
      serviceTime,
      rehearsalType,
      rehearsalDay,
      rehearsalTime,
      rehearsalDaysBefore: 2,
    };

    if (editingIndex !== null) {
      setServices(prev => prev.map((s, i) => i === editingIndex ? newService : s));
    } else {
      setServices(prev => [...prev, newService]);
    }

    resetForm();
  };

  // Edit existing service
  const handleEditService = (index: number) => {
    const service = services[index];
    setServiceName(service.name);
    setSelectedDay(service.defaultDay);
    setServiceTime(service.serviceTime);
    setRehearsalType(service.rehearsalType);
    setRehearsalDay(service.rehearsalDay);
    setRehearsalTime(service.rehearsalTime);
    setEditingIndex(index);
  };

  // Delete service
  const handleDeleteService = (index: number) => {
    Alert.alert(
      language === 'ko' ? '삭제' : 'Delete',
      language === 'ko' ? '이 예배/모임을 삭제하시겠습니까?' : 'Delete this?',
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '삭제' : 'Delete',
          style: 'destructive',
          onPress: () => {
            setServices(prev => prev.filter((_, i) => i !== index));
            if (editingIndex === index) {
              resetForm();
            }
          },
        },
      ]
    );
  };

  // Complete setup
  const handleComplete = () => {
    // Check for unsaved input
    if (serviceName.trim()) {
      Alert.alert(
        language === 'ko' ? '저장되지 않은 입력' : 'Unsaved Input',
        language === 'ko'
          ? `"${serviceName.trim()}"이(가) 아직 추가되지 않았습니다. 추가하시겠습니까?`
          : `"${serviceName.trim()}" hasn't been added yet. Would you like to add it?`,
        [
          {
            text: language === 'ko' ? '추가하고 완료' : 'Add & Complete',
            onPress: () => {
              handleSaveService();
              // Use setTimeout to allow state to update before completing
              setTimeout(() => completeSetup(), 100);
            },
          },
          {
            text: language === 'ko' ? '무시하고 완료' : 'Skip & Complete',
            style: 'destructive',
            onPress: () => completeSetup(),
          },
          { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    completeSetup();
  };

  // Actual completion logic
  const completeSetup = () => {
    if (services.length === 0 && !serviceName.trim()) {
      Alert.alert(
        language === 'ko' ? '오류' : 'Error',
        language === 'ko' ? '최소 1개의 예배/모임을 추가해주세요' : 'Please add at least one'
      );
      return;
    }

    // Clear existing and add new service types
    if (activeTeamId) {
      clearTeamServiceTypes(activeTeamId);

      services.forEach((service, index) => {
        addServiceTypeFull(activeTeamId, {
          name: service.name,
          scheduleType: service.scheduleType,
          defaultDay: service.defaultDay,
          serviceTime: service.serviceTime,
          rehearsalType: service.rehearsalType,
          rehearsalDay: service.rehearsalType === 'different_day' ? service.rehearsalDay : undefined,
          rehearsalTime: service.rehearsalType !== 'none' ? service.rehearsalTime : undefined,
          rehearsalDaysBefore: service.rehearsalType === 'days_before' ? service.rehearsalDaysBefore : undefined,
          isPrimary: index === 0,
        });
      });
    }

    // Navigate to main app
    router.replace('/(main)/(tabs)');
  };


  // Render Step 1: Pattern Selection
  const renderPatternStep = () => (
    <ScrollView style={styles.stepContent} contentContainerStyle={styles.stepContentScroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>
        {language === 'ko' ? '예배/모임 일정 패턴을 선택해주세요' : 'How do you schedule gatherings?'}
      </Text>
      <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
        {language === 'ko'
          ? '팀의 예배/모임 스케줄 방식을 알려주세요'
          : 'Tell us about your team\'s schedule'}
      </Text>

      <View style={styles.patternOptions}>
        {/* Recurring */}
        <TouchableOpacity
          style={[
            styles.patternCard,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            schedulePattern === 'recurring' && { borderColor: themeColors.primary, borderWidth: 2 },
          ]}
          onPress={() => setSchedulePattern('recurring')}
        >
          <View style={[styles.patternIcon, { backgroundColor: themeColors.primary + '15' }]}>
            <Ionicons name="calendar" size={28} color={themeColors.primary} />
          </View>
          <Text style={[styles.patternTitle, { color: themeColors.textPrimary }]}>
            {language === 'ko' ? '정기 예배/모임' : 'Regular Gatherings'}
          </Text>
          <Text style={[styles.patternDesc, { color: themeColors.textSecondary }]}>
            {language === 'ko'
              ? '매주 반복되는 예배/모임이 있어요\n(매주 일요일, 수요일 등)'
              : 'Weekly recurring gatherings\n(Every Sunday, Wednesday, etc.)'}
          </Text>
          {schedulePattern === 'recurring' && (
            <View style={[styles.checkBadge, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="checkmark" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Manual */}
        <TouchableOpacity
          style={[
            styles.patternCard,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            schedulePattern === 'manual' && { borderColor: themeColors.primary, borderWidth: 2 },
          ]}
          onPress={() => setSchedulePattern('manual')}
        >
          <View style={[styles.patternIcon, { backgroundColor: themeColors.info + '15' }]}>
            <Ionicons name="list" size={28} color={themeColors.info} />
          </View>
          <Text style={[styles.patternTitle, { color: themeColors.textPrimary }]}>
            {language === 'ko' ? '비정기 예배/모임' : 'Manual Scheduling'}
          </Text>
          <Text style={[styles.patternDesc, { color: themeColors.textSecondary }]}>
            {language === 'ko'
              ? '날짜를 직접 선택해요\n(특별 행사 등)'
              : 'Pick dates manually\n(Special events, etc.)'}
          </Text>
          {schedulePattern === 'manual' && (
            <View style={[styles.checkBadge, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="checkmark" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Both */}
        <TouchableOpacity
          style={[
            styles.patternCard,
            { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            schedulePattern === 'both' && { borderColor: themeColors.primary, borderWidth: 2 },
          ]}
          onPress={() => setSchedulePattern('both')}
        >
          <View style={[styles.patternIcon, { backgroundColor: themeColors.success + '15' }]}>
            <Ionicons name="sync" size={28} color={themeColors.success} />
          </View>
          <Text style={[styles.patternTitle, { color: themeColors.textPrimary }]}>
            {language === 'ko' ? '둘 다' : 'Both'}
          </Text>
          <Text style={[styles.patternDesc, { color: themeColors.textSecondary }]}>
            {language === 'ko'
              ? '정기 + 특별 예배/모임 모두 있어요'
              : 'Regular + special gatherings'}
          </Text>
          {schedulePattern === 'both' && (
            <View style={[styles.checkBadge, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="checkmark" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            styles.nextButtonFull,
            { backgroundColor: themeColors.primary },
            !schedulePattern && styles.buttonDisabled,
          ]}
          onPress={() => schedulePattern && setStep('services')}
          disabled={!schedulePattern}
        >
          <Text style={styles.nextButtonText}>
            {language === 'ko' ? '다음' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // Render Step 2: Services Setup
  const renderServicesStep = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.stepContent}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>
          {language === 'ko' ? '예배/모임 설정' : 'Set Up Gatherings'}
        </Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          {language === 'ko'
            ? '예배/모임 정보를 입력해주세요'
            : 'Enter your gathering details'}
        </Text>

        {/* Existing Services */}
        {services.length > 0 && (
          <View style={styles.servicesList}>
            {services.map((service, index) => (
              <View
                key={service.id}
                style={[styles.serviceItem, { backgroundColor: themeColors.surface }]}
              >
                <View style={styles.serviceItemInfo}>
                  <Text style={[styles.serviceItemName, { color: themeColors.textPrimary }]}>
                    {service.name}
                  </Text>
                  <Text style={[styles.serviceItemMeta, { color: themeColors.textSecondary }]}>
                    {days[service.defaultDay]} {service.serviceTime}
                    {service.rehearsalType !== 'none' && ` · ${language === 'ko' ? '연습' : 'Reh'} ${service.rehearsalTime}`}
                  </Text>
                </View>
                <View style={styles.serviceItemActions}>
                  <TouchableOpacity
                    style={[styles.serviceActionBtn, { backgroundColor: themeColors.background }]}
                    onPress={() => handleEditService(index)}
                  >
                    <Ionicons name="pencil" size={16} color={themeColors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.serviceActionBtn, { backgroundColor: themeColors.background }]}
                    onPress={() => handleDeleteService(index)}
                  >
                    <Ionicons name="trash-outline" size={16} color={themeColors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add/Edit Form */}
        <View style={[styles.formCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.formTitle, { color: themeColors.textPrimary }]}>
            {editingIndex !== null
              ? (language === 'ko' ? '수정' : 'Edit')
              : (language === 'ko' ? '새 예배/모임 추가' : 'Add New')}
          </Text>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
              {language === 'ko' ? '이름' : 'Name'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.background, color: themeColors.textPrimary, borderColor: themeColors.border }]}
              placeholder={language === 'ko' ? '예: 주일 2부, 토요모임' : 'e.g., Sunday 2nd, Saturday Gathering'}
              placeholderTextColor={themeColors.textMuted}
              value={serviceName}
              onChangeText={setServiceName}
            />
          </View>

          {/* Day Selection */}
          {(schedulePattern === 'recurring' || schedulePattern === 'both') && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                {language === 'ko' ? '요일' : 'Day'}
              </Text>
              <View style={styles.dayRow}>
                {days.map((day, i) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayBtn,
                      { backgroundColor: themeColors.background, borderColor: themeColors.border },
                      selectedDay === i && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                    ]}
                    onPress={() => setSelectedDay(i)}
                  >
                    <Text style={[
                      styles.dayBtnText,
                      { color: themeColors.textPrimary },
                      selectedDay === i && { color: '#FFF' },
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Service Time */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
              {language === 'ko' ? '시간' : 'Time'}
            </Text>
            <TouchableOpacity
              style={[styles.timePickerBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => setShowServiceTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={themeColors.primary} />
              <Text style={[styles.timePickerText, { color: themeColors.textPrimary }]}>
                {formatTimeDisplay(serviceTime, language)}
              </Text>
              <Ionicons name="chevron-down" size={16} color={themeColors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Rehearsal Type */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
              {language === 'ko' ? '연습 일정' : 'Rehearsal Schedule'}
            </Text>
            <View style={styles.rehearsalOptions}>
              <TouchableOpacity
                style={[
                  styles.rehearsalOption,
                  { backgroundColor: themeColors.background, borderColor: themeColors.border },
                  rehearsalType === 'same_day' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' },
                ]}
                onPress={() => setRehearsalType('same_day')}
              >
                <View style={[styles.radioOuter, { borderColor: rehearsalType === 'same_day' ? themeColors.primary : themeColors.border }]}>
                  {rehearsalType === 'same_day' && <View style={[styles.radioInner, { backgroundColor: themeColors.primary }]} />}
                </View>
                <Text style={[styles.rehearsalOptionText, { color: themeColors.textPrimary }]}>
                  {language === 'ko' ? '당일' : 'Same day'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rehearsalOption,
                  { backgroundColor: themeColors.background, borderColor: themeColors.border },
                  rehearsalType === 'different_day' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' },
                ]}
                onPress={() => setRehearsalType('different_day')}
              >
                <View style={[styles.radioOuter, { borderColor: rehearsalType === 'different_day' ? themeColors.primary : themeColors.border }]}>
                  {rehearsalType === 'different_day' && <View style={[styles.radioInner, { backgroundColor: themeColors.primary }]} />}
                </View>
                <Text style={[styles.rehearsalOptionText, { color: themeColors.textPrimary }]}>
                  {language === 'ko' ? '다른 요일' : 'Different day'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rehearsalOption,
                  { backgroundColor: themeColors.background, borderColor: themeColors.border },
                  rehearsalType === 'none' && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '10' },
                ]}
                onPress={() => setRehearsalType('none')}
              >
                <View style={[styles.radioOuter, { borderColor: rehearsalType === 'none' ? themeColors.primary : themeColors.border }]}>
                  {rehearsalType === 'none' && <View style={[styles.radioInner, { backgroundColor: themeColors.primary }]} />}
                </View>
                <Text style={[styles.rehearsalOptionText, { color: themeColors.textPrimary }]}>
                  {language === 'ko' ? '연습 없음' : 'No rehearsal'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Rehearsal Day (if different_day) */}
          {rehearsalType === 'different_day' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                {language === 'ko' ? '연습 요일' : 'Rehearsal Day'}
              </Text>
              <View style={styles.dayRow}>
                {days.map((day, i) => (
                  <TouchableOpacity
                    key={`reh-${day}`}
                    style={[
                      styles.dayBtn,
                      { backgroundColor: themeColors.background, borderColor: themeColors.border },
                      rehearsalDay === i && { backgroundColor: themeColors.info, borderColor: themeColors.info },
                    ]}
                    onPress={() => setRehearsalDay(i)}
                  >
                    <Text style={[
                      styles.dayBtnText,
                      { color: themeColors.textPrimary },
                      rehearsalDay === i && { color: '#FFF' },
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Rehearsal Time */}
          {rehearsalType !== 'none' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>
                {language === 'ko' ? '연습 시간' : 'Rehearsal Time'}
              </Text>
              <TouchableOpacity
                style={[styles.timePickerBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                onPress={() => setShowRehearsalTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={themeColors.info} />
                <Text style={[styles.timePickerText, { color: themeColors.textPrimary }]}>
                  {formatTimeDisplay(rehearsalTime, language)}
                </Text>
                <Ionicons name="chevron-down" size={16} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Add/Update Button */}
          <TouchableOpacity
            style={[styles.addServiceBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleSaveService}
          >
            <Ionicons name={editingIndex !== null ? 'checkmark' : 'add'} size={20} color="#FFF" />
            <Text style={styles.addServiceBtnText}>
              {editingIndex !== null
                ? (language === 'ko' ? '수정' : 'Update')
                : (language === 'ko' ? '추가' : 'Add')}
            </Text>
          </TouchableOpacity>

          {editingIndex !== null && (
            <TouchableOpacity
              style={[styles.cancelEditBtn, { borderColor: themeColors.border }]}
              onPress={resetForm}
            >
              <Text style={[styles.cancelEditBtnText, { color: themeColors.textSecondary }]}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Navigation */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: themeColors.border }]}
            onPress={() => setStep('pattern')}
          >
            <Ionicons name="arrow-back" size={18} color={themeColors.textSecondary} />
            <Text style={[styles.backButtonText, { color: themeColors.textSecondary }]}>
              {language === 'ko' ? '이전' : 'Back'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: themeColors.primary },
              services.length === 0 && styles.buttonDisabled,
            ]}
            onPress={handleComplete}
            disabled={services.length === 0}
          >
            <Text style={styles.nextButtonText}>
              {language === 'ko' ? '완료' : 'Complete'}
            </Text>
            <Ionicons name="checkmark" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Time Pickers */}
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
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          {language === 'ko' ? '예배/모임 설정' : 'Setup'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressStep, step === 'pattern' && styles.progressStepActive, { backgroundColor: step === 'pattern' ? themeColors.primary : themeColors.border }]} />
        <View style={[styles.progressStep, step === 'services' && styles.progressStepActive, { backgroundColor: step === 'services' ? themeColors.primary : themeColors.border }]} />
      </View>

      {/* Content */}
      {step === 'pattern' && renderPatternStep()}
      {step === 'services' && renderServicesStep()}
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressStepActive: {
    // active color applied inline
  },
  stepContent: {
    flex: 1,
    padding: spacing.lg,
  },
  stepContentScroll: {
    paddingBottom: spacing.xl,
  },
  stepTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xl,
  },
  patternOptions: {
    gap: spacing.md,
  },
  patternCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    position: 'relative',
  },
  patternIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  patternTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  patternDesc: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#FFF',
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Services Step
  servicesList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  serviceItemInfo: {
    flex: 1,
  },
  serviceItemName: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  serviceItemMeta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  serviceItemActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  serviceActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
  },
  formTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: spacing.md,
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
  rehearsalOptions: {
    gap: spacing.sm,
  },
  rehearsalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rehearsalOptionText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  addServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  addServiceBtnText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelEditBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  cancelEditBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
