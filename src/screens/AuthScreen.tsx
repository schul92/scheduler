import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../components/Button';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import {
  signInWithGoogle,
  signInWithApple,
  isAppleAuthAvailable,
} from '../lib/auth';

interface AuthScreenProps {
  onBack: () => void;
  onEmailAuth: () => void;
  onLogin: () => void;
  onAuthSuccess?: () => void;
}

// Google Logo Component
const GoogleLogo = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
      fill="#FBBC05"
    />
    <Path
      d="M12 4.61c1.61 0 3.06.56 4.23 1.68l3.18-3.18C17.45 1.15 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

// Apple Logo Component
const AppleLogo = ({ color = '#FFFFFF' }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill={color}>
    <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.89 3.51-.84 1.54.06 2.7.79 3.44 1.92-3.03 1.86-2.47 5.92.51 7.15-.53 1.34-1.29 2.72-2.54 3.96zM12.03 7.25c-.25-2.19 1.62-3.96 3.53-4.14.28 2.34-2.02 4.31-3.53 4.14z" />
  </Svg>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onBack,
  onEmailAuth,
  onLogin,
  onAuthSuccess,
}) => {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(true);

  useEffect(() => {
    checkAppleAuth();
  }, []);

  const checkAppleAuth = async () => {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  };

  const handleGoogleAuth = async () => {
    setLoadingGoogle(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (error.message !== 'User cancelled authentication') {
          Alert.alert(
            '로그인 실패',
            'Google 로그인 중 오류가 발생했습니다. 다시 시도해주세요.'
          );
          console.error('Google auth error:', error);
        }
      } else {
        onAuthSuccess?.();
      }
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('오류', '예상치 못한 오류가 발생했습니다.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleAppleAuth = async () => {
    setLoadingApple(true);
    try {
      const { error } = await signInWithApple();
      if (error) {
        if (error.message !== 'User cancelled authentication') {
          Alert.alert(
            '로그인 실패',
            'Apple 로그인 중 오류가 발생했습니다. 다시 시도해주세요.'
          );
          console.error('Apple auth error:', error);
        }
      } else {
        onAuthSuccess?.();
      }
    } catch (error) {
      console.error('Apple auth error:', error);
      Alert.alert('오류', '예상치 못한 오류가 발생했습니다.');
    } finally {
      setLoadingApple(false);
    }
  };

  const isLoading = loadingGoogle || loadingApple;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.navy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>계정 생성/로그인</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Hero / Illustration Section */}
          <View style={styles.heroSection}>
            <View style={styles.illustrationContainer}>
              <MaterialIcons name="music-note" size={64} color={COLORS.navy} />
              <View style={styles.decorativeCircle} />
            </View>
          </View>

          {/* Headlines */}
          <View style={styles.headlineSection}>
            <Text style={styles.headline}>어떻게 시작하시겠어요?</Text>
            <Text style={styles.subheadline}>
              찬양팀 스케줄링과 그룹 관리를 위해{'\n'}계정을 생성하거나 로그인해주세요.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsSection}>
            {/* Email Sign Up */}
            <Button
              title="이메일로 계속하기"
              onPress={onEmailAuth}
              variant="secondary"
              icon="mail"
              disabled={isLoading}
            />

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>소셜 계정으로 시작</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign Up */}
            <TouchableOpacity
              style={[
                styles.socialButton,
                styles.googleButton,
                isLoading && styles.disabledButton,
              ]}
              onPress={handleGoogleAuth}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {loadingGoogle ? (
                <ActivityIndicator color={COLORS.navy} />
              ) : (
                <>
                  <GoogleLogo />
                  <Text style={styles.googleButtonText}>
                    Google 계정으로 계속하기
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Sign Up */}
            {appleAuthAvailable && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  styles.appleButton,
                  isLoading && styles.disabledButton,
                ]}
                onPress={handleAppleAuth}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                {loadingApple ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <AppleLogo />
                    <Text style={styles.appleButtonText}>
                      Apple 계정으로 계속하기
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>이미 계정이 있으신가요? </Text>
          <TouchableOpacity onPress={onLogin} disabled={isLoading}>
            <Text style={[styles.loginLink, isLoading && styles.disabledText]}>
              로그인
            </Text>
          </TouchableOpacity>
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(248, 247, 246, 0.8)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  illustrationContainer: {
    width: 128,
    height: 128,
    borderRadius: SIZES.radiusLarge,
    backgroundColor: `${COLORS.navy}08`,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  decorativeCircle: {
    position: 'absolute',
    top: -16,
    right: -16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.primary}30`,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
      },
      android: {},
    }),
  },
  headlineSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 12,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonsSection: {
    gap: 16,
    marginTop: 'auto',
    marginBottom: 24,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: SIZES.buttonHeight,
    borderRadius: SIZES.radiusMedium,
  },
  googleButton: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  googleButtonText: {
    fontSize: SIZES.medium,
    fontWeight: '700',
    color: COLORS.navy,
    letterSpacing: 0.5,
  },
  appleButton: {
    backgroundColor: '#000000',
    ...SHADOWS.medium,
  },
  appleButtonText: {
    fontSize: SIZES.medium,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: SIZES.paddingHorizontal,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
