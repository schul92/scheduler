/**
 * Profile Setup Screen
 *
 * Based on Stitch design: 프로필_설정_(초기)
 * Uses shared parts from userProfileStore
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
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useUserProfileStore, DEFAULT_PARTS } from '../../store/userProfileStore';
import { colors, spacing, borderRadius, fontSize, shadows } from '../../lib/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { setParts, addCustomPart, customParts, getAllParts } = useUserProfileStore();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Custom part modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customPartName, setCustomPartName] = useState('');
  const [customPartEmoji, setCustomPartEmoji] = useState('🎵');

  // US phone format: (123) 456-7890
  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const togglePart = (partId: string) => {
    setSelectedParts((prev) =>
      prev.includes(partId)
        ? prev.filter((id) => id !== partId)
        : [...prev, partId]
    );
  };

  const handleAddCustomPart = () => {
    if (!customPartName.trim()) return;
    // Add custom part and get the ID back
    const newPartId = addCustomPart(customPartName.trim(), customPartEmoji);
    // Add to local selectedParts state
    setSelectedParts((prev) => [...prev, newPartId]);
    setCustomPartName('');
    setCustomPartEmoji('🎵');
    setShowCustomModal(false);
  };

  // Get all parts including custom ones
  const allParts = getAllParts();

  const handleComplete = async () => {
    if (!fullName.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (selectedParts.length === 0) {
      setError('파트를 선택해주세요');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not found');
      }

      // Update user profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: phone.replace(/\D/g, '') || null,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Save selected parts to local store
      setParts(selectedParts);

      // Check if user is a leader based on role param passed from auth screen
      const isLeader = role === 'owner' || role === 'admin';

      if (isLeader) {
        // Leaders need to set up services
        router.push('/(auth)/service-setup');
      } else {
        // Members skip service setup and go to main app
        router.replace('/(main)/(tabs)');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError('프로필 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필 설정</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            <View style={styles.photoWrapper}>
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={48} color={colors.textMuted} />
              </View>
              <TouchableOpacity style={styles.cameraButton}>
                <Ionicons name="camera" size={16} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={styles.photoHint}>프로필 사진 등록</Text>
          </View>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>이름</Text>
              <Text style={styles.required}>(필수)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="홍길동"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setError('');
              }}
            />
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>전화번호</Text>
              <Text style={styles.optional}>(선택)</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="(123) 456-7890"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={(text) => setPhone(formatPhoneNumber(text))}
              keyboardType="phone-pad"
              maxLength={14}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Parts Section */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionTitle}>내 파트</Text>
              <Text style={styles.required}>(필수)</Text>
            </View>
            <Text style={styles.sectionHint}>담당 가능한 파트를 모두 선택해주세요</Text>

            <View style={styles.partsGrid}>
              {allParts.map((part) => {
                const isSelected = selectedParts.includes(part.id);
                return (
                  <TouchableOpacity
                    key={part.id}
                    style={[
                      styles.partOption,
                      isSelected && styles.partOptionSelected,
                    ]}
                    onPress={() => {
                      togglePart(part.id);
                      setError('');
                    }}
                  >
                    <Text style={styles.partEmoji}>{part.emoji}</Text>
                    <Text style={[
                      styles.partName,
                      isSelected && styles.partNameSelected,
                    ]}>
                      {part.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Ionicons name="checkmark" size={12} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {/* Add Custom Part Button */}
              <TouchableOpacity
                style={styles.addCustomButton}
                onPress={() => setShowCustomModal(true)}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                <Text style={styles.addCustomText}>직접 추가</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Complete Button */}
          <TouchableOpacity
            style={[
              styles.completeButton,
              (!fullName.trim() || selectedParts.length === 0 || isLoading) && styles.completeButtonDisabled,
            ]}
            onPress={handleComplete}
            disabled={!fullName.trim() || selectedParts.length === 0 || isLoading}
          >
            <Text style={styles.completeButtonText}>
              {isLoading ? '저장 중...' : '설정 완료'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Part Modal */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>파트 직접 추가</Text>

            <View style={styles.emojiSelector}>
              <Text style={styles.inputLabel}>이모지 선택</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiList}>
                {['🎵', '🎸', '🎹', '🥁', '🎤', '🎻', '🪕', '🎺', '🎷', '🪈', '🔔', '✨'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      customPartEmoji === emoji && styles.emojiOptionSelected,
                    ]}
                    onPress={() => setCustomPartEmoji(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.inputLabel}>파트 이름</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 첼로"
                placeholderTextColor={colors.textMuted}
                value={customPartName}
                onChangeText={setCustomPartName}
                autoFocus
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCustomModal(false);
                  setCustomPartName('');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  !customPartName.trim() && styles.modalConfirmDisabled,
                ]}
                onPress={handleAddCustomPart}
                disabled={!customPartName.trim()}
              >
                <Text style={styles.modalConfirmText}>추가</Text>
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
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  photoHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  required: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  optional: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  partOptionSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  partEmoji: {
    fontSize: 18,
  },
  partName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  partNameSelected: {
    color: colors.primary,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginBottom: spacing.md,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textLight,
  },
  // Custom part button
  addCustomButton: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  addCustomText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.primary,
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
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emojiSelector: {
    marginBottom: spacing.md,
  },
  emojiList: {
    marginTop: spacing.sm,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  emojiText: {
    fontSize: 22,
  },
  modalInputGroup: {
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalConfirmDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textLight,
  },
});
