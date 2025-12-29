import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

const { height } = Dimensions.get('window');

interface JoinGroupScreenProps {
  onJoinGroup: (code: string) => void;
  onCreateGroup: () => void;
}

export const JoinGroupScreen: React.FC<JoinGroupScreenProps> = ({
  onJoinGroup,
  onCreateGroup,
}) => {
  const [groupCode, setGroupCode] = useState('');

  const handleJoinGroup = () => {
    if (groupCode.trim()) {
      onJoinGroup(groupCode.trim());
    }
  };

  return (
    <View style={styles.container}>
      {/* Decorative Background Elements */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header / Logo Section */}
            <View style={styles.headerSection}>
              <View style={styles.logoContainer}>
                <MaterialIcons
                  name="music-note"
                  size={40}
                  color={COLORS.navy}
                />
              </View>
              <Text style={styles.title}>찬양팀</Text>
              <Text style={styles.subtitle}>
                환영합니다!{'\n'}팀과 함께 찬양을 준비해보세요.
              </Text>
            </View>

            {/* Action Form Section */}
            <View style={styles.formCard}>
              <Input
                label="그룹 코드"
                placeholder="코드 입력"
                icon="vpn-key"
                value={groupCode}
                onChangeText={setGroupCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Button
                title="그룹 참여"
                onPress={handleJoinGroup}
                variant="primary"
                disabled={!groupCode.trim()}
                style={styles.joinButton}
              />
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Secondary Action: Create Group */}
            <View style={styles.createSection}>
              <Text style={styles.createText}>새로운 그룹을 만드시나요?</Text>
              <Button
                title="새 그룹 생성하기"
                onPress={onCreateGroup}
                variant="outline"
                icon="add-circle"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2024 찬양팀 스케줄러</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: `${COLORS.primary}15`,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 80,
      },
      android: {},
    }),
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: '-10%',
    right: '-5%',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: `${COLORS.navy}08`,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingVertical: 32,
    minHeight: height * 0.8,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    transform: [{ rotate: '3deg' }],
    ...SHADOWS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.navy,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: `${COLORS.navy}B3`,
    textAlign: 'center',
    lineHeight: 24,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: SIZES.radiusLarge,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: SIZES.paddingHorizontal,
    gap: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  joinButton: {
    marginTop: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  createSection: {
    alignItems: 'center',
    gap: 16,
  },
  createText: {
    fontSize: 14,
    fontWeight: '500',
    color: `${COLORS.navy}B3`,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: `${COLORS.textSecondary}99`,
  },
});
