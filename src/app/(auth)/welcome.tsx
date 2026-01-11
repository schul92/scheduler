/**
 * Welcome Screen Route
 *
 * Refactored to use NativeWind v4 with Tailwind CSS classes
 */

import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cssInterop } from 'nativewind';

// Enable NativeWind className support for LinearGradient
cssInterop(LinearGradient, {
  className: 'style',
});

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-lg">
        {/* Logo/Icon Area */}
        <View className="mb-xl">
          <View className="w-[120px] h-[120px] rounded-full bg-surface items-center justify-center shadow-lg">
            <Text className="text-[56px]">🎵</Text>
          </View>
        </View>

        {/* Title */}
        <Text className="text-4xl font-bold text-text-primary mb-1">찬양팀</Text>
        <Text className="text-xl font-medium text-primary mb-md">PraiseFlow</Text>
        <Text className="text-base text-text-secondary text-center mb-xxl">
          예배 팀을 위한 스마트한 스케줄 관리
        </Text>

        {/* Buttons */}
        <View className="w-full gap-md">
          <TouchableOpacity
            className="w-full rounded-md overflow-hidden"
            onPress={() => router.push('/(auth)/join-group')}
          >
            <LinearGradient
              colors={['#D4A574', '#B8956A']}
              className="py-md items-center"
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text className="text-lg font-semibold text-white">시작하기</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-md items-center"
            onPress={() => router.push('/(auth)/auth')}
          >
            <Text className="text-sm text-text-secondary">
              이미 계정이 있으신가요? 로그인
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
