import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted }) => {
  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[`${COLORS.primary}10`, 'transparent']}
        style={styles.topGradient}
      />

      {/* Decorative Blurs */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      <SafeAreaView style={styles.safeArea}>
        {/* Main Content */}
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            {/* Logo Glow */}
            <View style={styles.logoGlow} />

            {/* Logo Container */}
            <View style={styles.logoContainer}>
              <View style={styles.logoInner}>
                <MaterialIcons
                  name="groups"
                  size={80}
                  color={COLORS.primary}
                />
                <View style={styles.musicNoteContainer}>
                  <MaterialIcons
                    name="music-note"
                    size={32}
                    color={COLORS.navy}
                  />
                </View>
              </View>
            </View>

            {/* Brand Name */}
            <View style={styles.brandContainer}>
              <Text style={styles.brandName}>찬양팀</Text>
              <View style={styles.brandUnderline} />
            </View>
          </View>

          {/* Text Content */}
          <View style={styles.textContent}>
            <Text style={styles.welcomeTitle}>환영합니다!</Text>
            <Text style={styles.welcomeDescription}>
              찬양팀 일정을 쉽고 간편하게{'\n'}관리하는 새로운 경험을 시작하세요.
            </Text>
          </View>
        </View>

        {/* Bottom Action Section */}
        <View style={styles.bottomSection}>
          <LinearGradient
            colors={[`${COLORS.backgroundLight}00`, COLORS.backgroundLight, COLORS.backgroundLight]}
            style={styles.bottomGradient}
          >
            <Button
              title="시작하기"
              onPress={onGetStarted}
              variant="primary"
            />
            <Text style={styles.versionText}>버전 1.0.0</Text>
          </LinearGradient>
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
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: `${COLORS.primary}15`,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 48,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  decorativeCircle2: {
    position: 'absolute',
    top: height * 0.33,
    left: -48,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: `${COLORS.navy}08`,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 32,
    backgroundColor: `${COLORS.primary}20`,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: {},
    }),
  },
  logoContainer: {
    width: 144,
    height: 144,
    borderRadius: 32,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.large,
  },
  logoInner: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicNoteContainer: {
    position: 'absolute',
    top: -8,
    right: -16,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: -0.5,
  },
  brandUnderline: {
    width: 48,
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginTop: 12,
  },
  textContent: {
    alignItems: 'center',
    maxWidth: 280,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 12,
  },
  welcomeDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: `${COLORS.navy}B3`,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    width: '100%',
  },
  bottomGradient: {
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    paddingTop: 16,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
    color: `${COLORS.navy}66`,
    fontWeight: '500',
  },
});
