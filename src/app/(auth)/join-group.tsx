/**
 * Join/Create Group Screen
 *
 * Based on Stitch designs:
 * - 시작_페이지:_그룹_참여/생성
 * - 그룹_정보_입력_(리더_only)
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, shadows } from '../../lib/theme';
import { TEAM_COLORS } from '../../lib/constants';
import { useTeamStore } from '../../store/teamStore';
import { getSession, signOut } from '../../lib/supabase';
import { createTeam, joinTeamByCode } from '../../lib/api/teams';

type Mode = 'select' | 'join' | 'create';

export default function JoinGroupScreen() {
  const router = useRouter();
  const { fetchTeams } = useTeamStore();
  const [mode, setMode] = useState<Mode>('select');
  const [groupCode, setGroupCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(TEAM_COLORS[0]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    getSession().then((session) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  const handleBack = () => {
    if (mode === 'select') {
      router.back();
    } else {
      setMode('select');
      setError('');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      '로그아웃',
      '다른 계정으로 로그인하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  const handleContinue = async () => {
    if (mode === 'join') {
      if (!groupCode.trim()) {
        setError('그룹 코드를 입력해주세요');
        return;
      }

      // If authenticated, join directly
      if (isAuthenticated) {
        setIsLoading(true);
        setError('');
        try {
          const result = await joinTeamByCode(groupCode.toUpperCase());
          if (result) {
            await fetchTeams();
            // Root layout will handle navigation to tabs
          } else {
            setError('유효하지 않은 그룹 코드입니다');
          }
        } catch (err: any) {
          setError(err.message || '그룹 참여에 실패했습니다');
        } finally {
          setIsLoading(false);
        }
      } else {
        // Not authenticated, go to auth
        router.push({
          pathname: '/(auth)/auth',
          params: { groupCode: groupCode.toUpperCase(), mode: 'join' },
        });
      }
    } else if (mode === 'create') {
      if (!groupName.trim()) {
        setError('그룹 이름을 입력해주세요');
        return;
      }
      if (groupName.trim().length < 2) {
        setError('그룹 이름은 2자 이상이어야 합니다');
        return;
      }

      // If authenticated, create directly
      if (isAuthenticated) {
        setIsLoading(true);
        setError('');
        try {
          const team = await createTeam({
            name: groupName.trim(),
            description: groupDescription.trim() || undefined,
            color: selectedColor,
          });
          if (team) {
            await fetchTeams();
            // Root layout will handle navigation to tabs
          } else {
            setError('그룹 생성에 실패했습니다');
          }
        } catch (err: any) {
          setError(err.message || '그룹 생성에 실패했습니다');
        } finally {
          setIsLoading(false);
        }
      } else {
        // Not authenticated, go to auth
        router.push({
          pathname: '/(auth)/auth',
          params: {
            groupName: groupName.trim(),
            groupDescription: groupDescription.trim(),
            groupColor: selectedColor,
            mode: 'create',
          },
        });
      }
    }
  };

  // Get first character for preview avatar
  const getInitial = (name: string) => {
    return name.trim().charAt(0) || '팀';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          {mode === 'select' ? (
            // Show sign out button if authenticated, back button if not
            isAuthenticated ? (
              <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                <Text style={styles.signOutText}>로그아웃</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          {mode === 'select' && (
            <>
              {/* Title Section */}
              <View>
                <Text style={styles.title}>그룹 참여</Text>
                <Text style={styles.subtitle}>
                  기존 그룹에 참여하거나 새 그룹을 만드세요
                </Text>
              </View>

              {/* Option Cards */}
              <View style={styles.optionContainer}>
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => setMode('join')}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name="people" size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.optionTitle}>그룹 참여하기</Text>
                  <Text style={styles.optionDescription}>
                    초대 코드로 기존 그룹에 참여
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => setMode('create')}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name="add-circle" size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.optionTitle}>새 그룹 만들기</Text>
                  <Text style={styles.optionDescription}>
                    새로운 찬양팀 그룹 생성
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === 'join' && (
            <>
              {/* Title Section */}
              <View>
                <Text style={styles.title}>그룹 코드 입력</Text>
                <Text style={styles.subtitle}>
                  리더에게 받은 8자리 코드를 입력하세요
                </Text>
              </View>

              {/* Form Card */}
              <View>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="ABC12345"
                    placeholderTextColor={colors.textSecondary}
                    value={groupCode}
                    onChangeText={(text) => {
                      setGroupCode(text.toUpperCase());
                      setError('');
                    }}
                    autoCapitalize="characters"
                    maxLength={8}
                  />
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>

                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    (!groupCode.trim() || isLoading) && styles.continueButtonDisabled,
                  ]}
                  onPress={handleContinue}
                  disabled={!groupCode.trim() || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.textLight} />
                  ) : (
                    <Text style={styles.continueButtonText}>
                      {isAuthenticated ? '참여하기' : '계속'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === 'create' && (
            <ScrollView
              style={styles.createScrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title */}
              <View>
                <Text style={styles.title}>새 그룹 만들기</Text>
              </View>

              {/* Form Card */}
              <View>
              {/* Group Name */}
              <View style={styles.fieldContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>그룹 이름</Text>
                  <Text style={styles.required}>(필수)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="주일 찬양팀"
                  placeholderTextColor={colors.textMuted}
                  value={groupName}
                  onChangeText={(text) => {
                    setGroupName(text);
                    setError('');
                  }}
                  autoCapitalize="words"
                />
                <Text style={styles.helperText}>
                  <Ionicons name="information-circle" size={12} color={colors.textSecondary} />
                  {' '}멤버들에게 보여질 이름이에요
                </Text>
              </View>

              {/* Group Description */}
              <View style={styles.fieldContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>그룹 설명</Text>
                  <Text style={styles.optional}>(선택)</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="그룹에 대한 간단한 설명"
                  placeholderTextColor={colors.textMuted}
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Color Picker */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>그룹 색상</Text>
                <View style={styles.colorPicker}>
                  {TEAM_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                    >
                      {selectedColor === color && (
                        <Ionicons name="checkmark" size={20} color={colors.textLight} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Preview Card */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>미리보기</Text>
                <View style={styles.previewCard}>
                  <View style={[styles.previewAvatar, { backgroundColor: selectedColor }]}>
                    <Text style={styles.previewAvatarText}>
                      {getInitial(groupName)}
                    </Text>
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName}>
                      {groupName || '그룹 이름'}
                    </Text>
                    <Text style={styles.previewMeta}>
                      1명 · 관리자 ⭐
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
                <Text style={styles.previewHelperText}>
                  생성 후 그룹 설정에서 언제든지 변경할 수 있습니다.
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Create Button */}
              <TouchableOpacity
                style={[
                  styles.createButton,
                  (!groupName.trim() || isLoading) && styles.createButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!groupName.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={styles.createButtonText}>그룹 만들기</Text>
                )}
              </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  signOutText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  optionContainer: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  optionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  inputContainer: {
    marginBottom: spacing.lg,
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
  codeInput: {
    fontSize: fontSize['2xl'],
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 4,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textLight,
  },
  // Create mode styles
  createScrollView: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
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
  helperText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  textArea: {
    height: 100,
    paddingTop: spacing.md,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.textLight,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previewAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textLight,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  previewMeta: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  previewHelperText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textLight,
  },
});
