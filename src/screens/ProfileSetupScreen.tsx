import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const ROLES = [
  { id: 'worship_leader', label: '인도자', labelEn: 'Worship Leader' },
  { id: 'vocal', label: '보컬', labelEn: 'Vocal' },
  { id: 'piano', label: '피아노', labelEn: 'Piano' },
  { id: 'synthesizer', label: '신디사이저', labelEn: 'Synthesizer' },
  { id: 'drums', label: '드럼', labelEn: 'Drums' },
  { id: 'bass', label: '베이스', labelEn: 'Bass' },
  { id: 'electric_guitar', label: '일렉기타', labelEn: 'Electric Guitar' },
  { id: 'acoustic_guitar', label: '어쿠스틱', labelEn: 'Acoustic Guitar' },
  { id: 'violin', label: '바이올린', labelEn: 'Violin' },
  { id: 'broadcast', label: '방송/자막', labelEn: 'Broadcast' },
  { id: 'other', label: '기타', labelEn: 'Other' },
];

interface ProfileSetupScreenProps {
  onBack?: () => void;
  onComplete: (profile: {
    name: string;
    phone?: string;
    roles: string[];
    profileImage?: string;
  }) => void;
  initialData?: {
    name?: string;
    email?: string;
    profileImage?: string;
  };
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  onBack,
  onComplete,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState<string | undefined>(
    initialData?.profileImage
  );

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      alert('사진 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleComplete = () => {
    if (!name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    if (selectedRoles.length === 0) {
      alert('최소 하나의 역할을 선택해주세요.');
      return;
    }

    onComplete({
      name: name.trim(),
      phone: phone.trim() || undefined,
      roles: selectedRoles,
      profileImage,
    });
  };

  const isValid = name.trim() && selectedRoles.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2C3E50" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.headerTitle}>프로필 설정</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Image */}
        <View style={styles.profileImageSection}>
          <TouchableOpacity onPress={handleImagePick} style={styles.profileImageContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Ionicons name="person" size={48} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileImageLabel}>프로필 사진 등록</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Name Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>이름</Text>
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>필수</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder="이름을 입력하세요"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>전화번호</Text>
              <Text style={styles.optionalText}>선택</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="(123) 456-7890"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={(text) => {
                // Format as US phone number
                const cleaned = text.replace(/\D/g, '');
                let formatted = '';
                if (cleaned.length > 0) {
                  formatted = '(' + cleaned.substring(0, 3);
                }
                if (cleaned.length > 3) {
                  formatted += ') ' + cleaned.substring(3, 6);
                }
                if (cleaned.length > 6) {
                  formatted += '-' + cleaned.substring(6, 10);
                }
                setPhone(formatted);
              }}
              keyboardType="phone-pad"
              maxLength={14}
            />
          </View>

          <View style={styles.divider} />

          {/* Role Selection */}
          <View style={styles.roleSection}>
            <View style={styles.roleSectionHeader}>
              <Text style={styles.sectionTitle}>어떤 파트를 맡으시나요?</Text>
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>필수</Text>
              </View>
            </View>
            <Text style={styles.roleSubtitle}>복수 선택이 가능합니다</Text>

            <View style={styles.rolesGrid}>
              {ROLES.map((role) => {
                const isSelected = selectedRoles.includes(role.id);
                return (
                  <TouchableOpacity
                    key={role.id}
                    style={[
                      styles.roleButton,
                      isSelected && styles.roleButtonSelected,
                    ]}
                    onPress={() => toggleRole(role.id)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={isSelected ? '#FFFFFF' : '#D1D5DB'}
                    />
                    <Text
                      style={[
                        styles.roleButtonText,
                        isSelected && styles.roleButtonTextSelected,
                      ]}
                    >
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.completeButton, !isValid && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={!isValid}
        >
          <Text style={styles.completeButtonText}>설정 완료</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  profileImageSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  profileImagePlaceholder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D4A574',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FAFAFA',
  },
  profileImageLabel: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  formSection: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  requiredBadge: {
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  requiredText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D4A574',
  },
  optionalText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  input: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#2C3E50',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  roleSection: {
    gap: 12,
  },
  roleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
  },
  roleSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '47%',
  },
  roleButtonSelected: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  roleButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4B5563',
  },
  roleButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#FAFAFA',
  },
  completeButton: {
    height: 56,
    backgroundColor: '#D4A574',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  completeButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
