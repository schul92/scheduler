/**
 * Create Service Schedule Screen
 *
 * Assign team members to roles for worship services
 * Based on Stitch design (예배 스케줄 만들기)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Dimensions, Modal, TextInput, Share, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { useSchedulingStore, InstrumentSetup as StoreInstrumentSetup } from '../../../../store/schedulingStore';
import { useSetlistStore, Song } from '../../../../store/setlistStore';
import { useServiceTypeStore } from '../../../../store/serviceTypeStore';
import { spacing, borderRadius, fontSize, lightColors, shadows } from '../../../../lib/theme';
import { SongInput } from '../../../../components/SongInput';
import { supabase } from '../../../../lib/supabase';
import { TeamMember } from '../../../../types/database.types';
import { getTeamAvailability } from '../../../../lib/api/availability';

const staticColors = lightColors;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to parse YYYY-MM-DD string as local date (avoids UTC parsing issues)
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Instrument configuration for worship team
interface InstrumentConfig {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  minCount: number;
  maxCount: number;
  defaultCount: number;
  defaultEnabled: boolean;
  isCustom?: boolean;
}

// Default instruments available
const DEFAULT_INSTRUMENTS: InstrumentConfig[] = [
  { id: 'leader', name: '인도자', nameEn: 'Leader', emoji: '🎤', minCount: 1, maxCount: 2, defaultCount: 1, defaultEnabled: true },
  { id: 'keyboard', name: '건반', nameEn: 'Keyboard', emoji: '🎹', minCount: 0, maxCount: 2, defaultCount: 1, defaultEnabled: true },
  { id: 'drums', name: '드럼', nameEn: 'Drums', emoji: '🥁', minCount: 0, maxCount: 1, defaultCount: 1, defaultEnabled: true },
  { id: 'electric', name: '일렉기타', nameEn: 'E.Guitar', emoji: '🎸', minCount: 0, maxCount: 2, defaultCount: 1, defaultEnabled: true },
  { id: 'bass', name: '베이스', nameEn: 'Bass', emoji: '🎻', minCount: 0, maxCount: 1, defaultCount: 1, defaultEnabled: true },
  { id: 'acoustic', name: '어쿠스틱', nameEn: 'Acoustic', emoji: '🪕', minCount: 0, maxCount: 2, defaultCount: 0, defaultEnabled: false },
  { id: 'violin', name: '바이올린', nameEn: 'Violin', emoji: '🎻', minCount: 0, maxCount: 2, defaultCount: 0, defaultEnabled: false },
  { id: 'vocals', name: '싱어', nameEn: 'Vocals', emoji: '🎵', minCount: 0, maxCount: 8, defaultCount: 2, defaultEnabled: true },
];

// Instrument setup for a service
interface InstrumentSetup {
  instrumentId: string;
  count: number;
  enabled: boolean;
}

// Team member with user info for display
interface TeamMemberWithUser {
  id: string;
  user_id: string;
  nickname: string | null;
  parts: string[] | null;
  membership_role: string;
  user: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

// Simplified member for UI
interface DisplayMember {
  id: string;
  name: string;
  roles: string[];
  avatar: string | null;
}


// Member Selection Modal Component
interface MemberSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (memberId: string) => void;
  instrumentId: string;
  instrumentName: string;
  instrumentEmoji: string;
  assignedMemberIds: string[];
  teamMembers: DisplayMember[];
  memberAvailability: Record<string, 'available' | 'unavailable' | 'pending'>;
  colors: typeof lightColors;
  language: 'ko' | 'en';
}

function MemberSelectModal({ visible, onClose, onSelect, instrumentId, instrumentName, instrumentEmoji, assignedMemberIds, teamMembers, memberAvailability, colors, language }: MemberSelectModalProps) {
  // Filter members who can play this instrument
  const eligibleMembers = teamMembers.filter(m => m.roles.includes(instrumentId));

  // Categorize members
  const availableMembers = eligibleMembers.filter(m =>
    memberAvailability[m.id] === 'available' && !assignedMemberIds.includes(m.id)
  );
  const pendingMembers = eligibleMembers.filter(m =>
    memberAvailability[m.id] === 'pending' && !assignedMemberIds.includes(m.id)
  );
  const unavailableMembers = eligibleMembers.filter(m =>
    memberAvailability[m.id] === 'unavailable' && !assignedMemberIds.includes(m.id)
  );
  const alreadyAssigned = eligibleMembers.filter(m => assignedMemberIds.includes(m.id));

  // Handle selecting a member with warning
  const handleSelectWithWarning = (member: DisplayMember, status: 'pending' | 'unavailable') => {
    const title = status === 'pending'
      ? (language === 'ko' ? '응답 대기 멤버 배정' : 'Assign Pending Member')
      : (language === 'ko' ? '불가능 멤버 배정' : 'Assign Unavailable Member');

    const message = status === 'pending'
      ? (language === 'ko'
          ? `${member.name}님은 아직 가능 여부를 응답하지 않았습니다.\n\n그래도 배정하시겠습니까?\n(나중에 불가능으로 응답하면 알림을 받습니다)`
          : `${member.name} hasn't responded yet.\n\nAssign anyway?\n(You'll be notified if they respond as unavailable)`)
      : (language === 'ko'
          ? `${member.name}님은 이 날짜에 참석 불가능으로 응답했습니다.\n\n그래도 배정하시겠습니까?`
          : `${member.name} responded as unavailable for this date.\n\nAssign anyway?`);

    Alert.alert(
      title,
      message,
      [
        { text: language === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ko' ? '배정하기' : 'Assign',
          style: status === 'unavailable' ? 'destructive' : 'default',
          onPress: () => {
            onSelect(member.id);
            onClose();
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.content, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerLeft}>
              <Text style={modalStyles.headerEmoji}>{instrumentEmoji}</Text>
              <Text style={[modalStyles.title, { color: colors.textPrimary }]}>
                {instrumentName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Info Banner */}
          <View style={[modalStyles.infoBanner, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="information-circle" size={16} color={colors.primary} />
            <Text style={[modalStyles.infoBannerText, { color: colors.textSecondary }]}>
              {language === 'ko'
                ? '응답 대기/불가 멤버도 배정 가능합니다'
                : 'You can assign pending/unavailable members'}
            </Text>
          </View>

          <ScrollView style={modalStyles.memberList} showsVerticalScrollIndicator={false}>
            {/* Available Members */}
            {availableMembers.length > 0 && (
              <>
                <Text style={[modalStyles.sectionTitle, { color: colors.success }]}>
                  ✓ {language === 'ko' ? '참석 가능' : 'Available'} ({availableMembers.length})
                </Text>
                {availableMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[modalStyles.memberItem, { backgroundColor: colors.background, borderColor: colors.success + '40' }]}
                    onPress={() => {
                      onSelect(member.id);
                      onClose();
                    }}
                  >
                    <View style={[modalStyles.avatar, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[modalStyles.avatarText, { color: colors.primary }]}>
                        {member.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={modalStyles.memberInfo}>
                      <Text style={[modalStyles.memberName, { color: colors.textPrimary }]}>{member.name}</Text>
                      <View style={[modalStyles.statusBadge, { backgroundColor: colors.success + '15' }]}>
                        <View style={[modalStyles.statusDot, { backgroundColor: colors.success }]} />
                        <Text style={[modalStyles.statusText, { color: colors.success }]}>
                          {language === 'ko' ? '참석 가능' : 'Available'}
                        </Text>
                      </View>
                    </View>
                    <View style={[modalStyles.selectButton, { backgroundColor: colors.primary }]}>
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Pending Members - Can be selected with warning */}
            {pendingMembers.length > 0 && (
              <>
                <Text style={[modalStyles.sectionTitle, { color: colors.warning }]}>
                  ⏳ {language === 'ko' ? '응답 대기' : 'Pending Response'} ({pendingMembers.length})
                </Text>
                {pendingMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[modalStyles.memberItem, { backgroundColor: colors.background, borderColor: colors.warning + '40' }]}
                    onPress={() => handleSelectWithWarning(member, 'pending')}
                  >
                    <View style={[modalStyles.avatar, { backgroundColor: colors.warning + '20' }]}>
                      <Text style={[modalStyles.avatarText, { color: colors.warning }]}>
                        {member.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={modalStyles.memberInfo}>
                      <Text style={[modalStyles.memberName, { color: colors.textPrimary }]}>{member.name}</Text>
                      <View style={[modalStyles.statusBadge, { backgroundColor: colors.warning + '15' }]}>
                        <View style={[modalStyles.statusDot, { backgroundColor: colors.warning }]} />
                        <Text style={[modalStyles.statusText, { color: colors.warning }]}>
                          {language === 'ko' ? '응답 대기중' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    <View style={[modalStyles.selectButton, { backgroundColor: colors.warning }]}>
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Already Assigned */}
            {alreadyAssigned.length > 0 && (
              <>
                <Text style={[modalStyles.sectionTitle, { color: colors.textMuted }]}>
                  {language === 'ko' ? '이미 배정됨' : 'Already Assigned'} ({alreadyAssigned.length})
                </Text>
                {alreadyAssigned.map(member => (
                  <View
                    key={member.id}
                    style={[modalStyles.memberItem, modalStyles.memberItemDisabled, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <View style={[modalStyles.avatar, { backgroundColor: colors.border }]}>
                      <Text style={[modalStyles.avatarText, { color: colors.textMuted }]}>
                        {member.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={modalStyles.memberInfo}>
                      <Text style={[modalStyles.memberName, { color: colors.textMuted }]}>{member.name}</Text>
                      <Text style={[modalStyles.assignedLabel, { color: colors.textMuted }]}>
                        {language === 'ko' ? '이미 배정됨' : 'Already assigned'}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color={colors.textMuted} />
                  </View>
                ))}
              </>
            )}

            {/* Unavailable Members - Can be selected with strong warning */}
            {unavailableMembers.length > 0 && (
              <>
                <Text style={[modalStyles.sectionTitle, { color: colors.error }]}>
                  ✗ {language === 'ko' ? '참석 불가' : 'Unavailable'} ({unavailableMembers.length})
                </Text>
                {unavailableMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[modalStyles.memberItem, { backgroundColor: colors.background, borderColor: colors.error + '30' }]}
                    onPress={() => handleSelectWithWarning(member, 'unavailable')}
                  >
                    <View style={[modalStyles.avatar, { backgroundColor: colors.error + '15' }]}>
                      <Text style={[modalStyles.avatarText, { color: colors.error }]}>
                        {member.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={modalStyles.memberInfo}>
                      <Text style={[modalStyles.memberName, { color: colors.textPrimary }]}>{member.name}</Text>
                      <View style={[modalStyles.statusBadge, { backgroundColor: colors.error + '15' }]}>
                        <View style={[modalStyles.statusDot, { backgroundColor: colors.error }]} />
                        <Text style={[modalStyles.statusText, { color: colors.error }]}>
                          {language === 'ko' ? '참석 불가' : 'Unavailable'}
                        </Text>
                      </View>
                    </View>
                    <View style={[modalStyles.selectButton, { backgroundColor: colors.error + '80' }]}>
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* No eligible members */}
            {eligibleMembers.length === 0 && (
              <View style={modalStyles.emptyState}>
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={[modalStyles.emptyText, { color: colors.textSecondary }]}>
                  {language === 'ko' ? '이 역할을 수행할 수 있는\n팀원이 없습니다.' : 'No team members available\nfor this role.'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Modal styles
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.xs,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
  infoBannerText: {
    fontSize: fontSize.xs,
    flex: 1,
  },
  memberList: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  memberItemDisabled: {
    opacity: 0.6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  assignedLabel: {
    fontSize: fontSize.xs,
  },
  selectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default function CreateScheduleScreen() {
  const router = useRouter();
  const { teamId, date: initialDate, service: initialService } = useLocalSearchParams<{ teamId: string; date?: string; service?: string }>();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();

  // Get dates from scheduling store
  const {
    selectedDates,
    currentScheduleDate,
    setCurrentScheduleDate,
    goToNextDate,
    goToPrevDate,
    getCurrentDateIndex,
    hasDates,
    periodTitle,
    saveSchedule,
    getSchedule,
    schedules, // Subscribe to schedules to re-render when status changes
  } = useSchedulingStore();

  // Get custom service types
  const { getServiceTypes } = useServiceTypeStore();
  const serviceTypes = getServiceTypes(teamId || '');

  const sortedDates = [...selectedDates].sort();
  const dateListRef = useRef<FlatList>(null);
  const datePillsScrollRef = useRef<ScrollView>(null);
  const instrumentScrollRef = useRef<ScrollView>(null);
  const [datePillsScrollX, setDatePillsScrollX] = useState(0);
  const [instrumentScrollX, setInstrumentScrollX] = useState(0);

  // Scroll handlers for chevron buttons
  const scrollDatePillsRight = () => {
    datePillsScrollRef.current?.scrollTo({ x: datePillsScrollX + 200, animated: true });
  };

  const scrollInstrumentsRight = () => {
    instrumentScrollRef.current?.scrollTo({ x: instrumentScrollX + 200, animated: true });
  };

  // Track if we've applied the initial date from URL
  const hasAppliedInitialDate = useRef(false);

  // Initialize current date - use URL param if provided, otherwise first date
  useEffect(() => {
    if (sortedDates.length === 0) return;

    // If initialDate is provided and valid, use it (only on first render)
    if (initialDate && sortedDates.includes(initialDate) && !hasAppliedInitialDate.current) {
      hasAppliedInitialDate.current = true;
      setCurrentScheduleDate(initialDate);
    } else if (!currentScheduleDate && !initialDate) {
      // Otherwise default to first date if nothing is set
      setCurrentScheduleDate(sortedDates[0]);
    }
  }, [sortedDates, initialDate, currentScheduleDate, setCurrentScheduleDate]);

  // Get services for current date based on custom service types
  const currentServices = currentScheduleDate
    ? (() => {
        const dayOfWeek = parseLocalDate(currentScheduleDate).getDay();
        // Filter service types that match this day of week
        const matchingTypes = serviceTypes.filter(t => t.defaultDay === dayOfWeek);
        // If no matching types, show all Sunday services as fallback (for Sunday)
        const typesToShow = matchingTypes.length > 0 ? matchingTypes :
          (dayOfWeek === 0 ? serviceTypes.filter(t => t.defaultDay === 0) : []);

        if (typesToShow.length === 0) {
          // Fallback: show a generic service
          return [{ id: `${currentScheduleDate}-1`, name: language === 'ko' ? '예배' : 'Service', date: currentScheduleDate }];
        }

        return typesToShow.map((t, i) => ({
          id: `${currentScheduleDate}-${t.id}`,
          name: t.name,
          date: currentScheduleDate,
        }));
      })()
    : [];

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showSaveCheck, setShowSaveCheck] = useState(false);

  // Auto-select first service when services are available
  useEffect(() => {
    if (currentServices.length > 0) {
      // If no service selected or current selection is invalid, select first one
      const isValidSelection = selectedService && currentServices.some(s => s.id === selectedService);
      if (!isValidSelection) {
        setSelectedService(currentServices[0].id);
      }
    }
  }, [currentServices, selectedService]);

  // All instruments (default + custom)
  const [instruments, setInstruments] = useState<InstrumentConfig[]>(DEFAULT_INSTRUMENTS);

  // Instrument setup: which instruments are enabled and their counts
  const [instrumentSetup, setInstrumentSetup] = useState<Record<string, InstrumentSetup>>(() => {
    const initial: Record<string, InstrumentSetup> = {};
    DEFAULT_INSTRUMENTS.forEach(inst => {
      initial[inst.id] = {
        instrumentId: inst.id,
        count: inst.defaultCount,
        enabled: inst.defaultEnabled,
      };
    });
    return initial;
  });

  // Assignments: key = "instrumentId-slotIndex", value = memberId
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // Team members state - fetched from database
  const [teamMembers, setTeamMembers] = useState<DisplayMember[]>([]);
  const [memberAvailability, setMemberAvailability] = useState<Record<string, 'available' | 'unavailable' | 'pending'>>({});
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch team members from database
  const fetchTeamMembers = useCallback(async () => {
    if (!teamId) return;

    try {
      setIsLoadingMembers(true);

      // Fetch team members with user info
      const { data: members, error } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          nickname,
          parts,
          membership_role,
          users:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('team_id', teamId)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching team members:', error);
        return;
      }

      // Transform to DisplayMember format
      const displayMembers: DisplayMember[] = (members || []).map((m: any) => ({
        id: m.id,
        name: m.nickname || m.users?.full_name || 'Unknown',
        roles: m.parts || [],
        avatar: m.users?.avatar_url || null,
      }));

      setTeamMembers(displayMembers);

      // Initialize availability as pending until we fetch real data
      const availability: Record<string, 'available' | 'unavailable' | 'pending'> = {};
      displayMembers.forEach(m => {
        availability[m.id] = 'pending';
      });
      setMemberAvailability(availability);

    } catch (err) {
      console.error('Error in fetchTeamMembers:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [teamId]);

  // Fetch team members on mount
  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  // Auto-enable instruments based on team members' parts when they load
  useEffect(() => {
    if (teamMembers.length === 0 || isLoadingMembers) return;

    // Get all unique parts from team members
    const teamParts = new Set<string>();
    teamMembers.forEach(m => {
      m.roles.forEach(role => teamParts.add(role));
    });

    // Update instrument setup to only enable instruments that team members can play
    setInstrumentSetup(prev => {
      const updated = { ...prev };
      DEFAULT_INSTRUMENTS.forEach(inst => {
        const hasMemberWithPart = teamParts.has(inst.id);
        // Only auto-enable if a team member can play this instrument
        // Preserve existing count, just update enabled based on team
        if (updated[inst.id]) {
          updated[inst.id] = {
            ...updated[inst.id],
            enabled: hasMemberWithPart && inst.defaultEnabled,
          };
        }
      });
      return updated;
    });
  }, [teamMembers, isLoadingMembers]);

  // Fetch availability when date changes
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!teamId || !currentScheduleDate || teamMembers.length === 0) {
        return;
      }

      try {
        console.log('Fetching availability for date:', currentScheduleDate);
        const summary = await getTeamAvailability(teamId, currentScheduleDate);
        console.log('Availability summary:', summary);

        // Map API response to member availability state
        // The API returns by user_id, but our state uses team_member_id
        const availability: Record<string, 'available' | 'unavailable' | 'pending'> = {};

        teamMembers.forEach(member => {
          // Find this member's availability in the API response
          const memberAvail = summary.members.find(m => m.team_member_id === member.id);

          if (memberAvail) {
            if (!memberAvail.has_responded) {
              // They haven't submitted their availability yet
              availability[member.id] = 'pending';
            } else {
              // They've responded - check their answer
              availability[member.id] = memberAvail.is_available ? 'available' : 'unavailable';
            }
          } else {
            // Not in response at all = pending
            availability[member.id] = 'pending';
          }
        });

        console.log('Mapped availability:', availability);
        setMemberAvailability(availability);
      } catch (err) {
        console.error('Error fetching availability:', err);
        // On error, set all to pending
        const pendingAvailability: Record<string, 'available' | 'unavailable' | 'pending'> = {};
        teamMembers.forEach(m => {
          pendingAvailability[m.id] = 'pending';
        });
        setMemberAvailability(pendingAvailability);
      }
    };

    fetchAvailability();
  }, [teamId, currentScheduleDate, teamMembers]);

  // Member selection modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedInstrumentForModal, setSelectedInstrumentForModal] = useState<{
    instrumentId: string;
    slotIndex: number;
  } | null>(null);

  // Add custom instrument modal
  const [showAddInstrumentModal, setShowAddInstrumentModal] = useState(false);
  const [newInstrumentName, setNewInstrumentName] = useState('');

  // Preview/Confirmation modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Setlist section
  const [isSetlistExpanded, setIsSetlistExpanded] = useState(true);
  const { getSetlist, addSong, removeSong, updateSong, reorderSongs, getSongCount } = useSetlistStore();
  const currentSetlist = currentScheduleDate ? getSetlist(currentScheduleDate) : [];
  const setlistCount = currentScheduleDate ? getSongCount(currentScheduleDate) : 0;

  // Track if we're loading saved data (to prevent save during load)
  // Use a ref to track the date that was last loaded to prevent race conditions
  const isLoadingRef = useRef(false);
  const loadedDateRef = useRef<string | null>(null);

  // Track if we've applied the initial service from URL
  const hasAppliedInitialService = useRef(false);

  // Set initial service when date changes
  useEffect(() => {
    if (currentServices.length > 0) {
      // If initialService is provided and valid, use it (only on first render)
      if (initialService && currentServices.some(s => s.id === initialService) && !hasAppliedInitialService.current) {
        hasAppliedInitialService.current = true;
        setSelectedService(initialService);
      } else if (!hasAppliedInitialService.current) {
        setSelectedService(currentServices[0].id);
      }
    }
  }, [currentScheduleDate, initialService, currentServices]);

  // Load saved schedule when date or service type changes
  useEffect(() => {
    if (!currentScheduleDate || !selectedService) return;

    // Mark as loading and track which date we're loading
    isLoadingRef.current = true;
    loadedDateRef.current = null; // Clear until load completes

    const savedSchedule = getSchedule(currentScheduleDate, selectedService);

    if (savedSchedule) {
      // Load saved assignments
      setAssignments(savedSchedule.assignments);

      // Load saved instrument setups, merging with defaults
      const newSetup: Record<string, InstrumentSetup> = {};
      DEFAULT_INSTRUMENTS.forEach(inst => {
        const saved = savedSchedule.instrumentSetups[inst.id];
        if (saved) {
          newSetup[inst.id] = {
            instrumentId: inst.id,
            count: saved.count,
            enabled: saved.enabled,
          };
        } else {
          newSetup[inst.id] = {
            instrumentId: inst.id,
            count: inst.defaultCount,
            enabled: inst.defaultEnabled,
          };
        }
      });
      setInstrumentSetup(newSetup);
    } else {
      // Reset to defaults for new date - this is a fresh date with no saved data
      setAssignments({});
      const initial: Record<string, InstrumentSetup> = {};
      DEFAULT_INSTRUMENTS.forEach(inst => {
        initial[inst.id] = {
          instrumentId: inst.id,
          count: inst.defaultCount,
          enabled: inst.defaultEnabled,
        };
      });
      setInstrumentSetup(initial);
    }

    // Mark which date+service was loaded and allow saving after state settles
    // Use longer timeout to ensure React state has fully settled
    const dateBeingLoaded = currentScheduleDate;
    const serviceBeingLoaded = selectedService;
    const timeoutId = setTimeout(() => {
      // Only mark as loaded if we're still on the same date and service
      if (currentScheduleDate === dateBeingLoaded && selectedService === serviceBeingLoaded) {
        loadedDateRef.current = `${dateBeingLoaded}:${serviceBeingLoaded}`;
        isLoadingRef.current = false;
      }
    }, 300);

    // Cleanup timeout if date/service changes before it fires
    return () => {
      clearTimeout(timeoutId);
      isLoadingRef.current = true;
    };
  }, [currentScheduleDate, selectedService, getSchedule]);

  // Auto-save schedule when assignments or setup changes
  useEffect(() => {
    // Only save if:
    // 1. We have a current date and selected service
    // 2. We're not in loading state
    // 3. The loaded date+service matches current (prevents saving old data to new date/service)
    if (!currentScheduleDate || !selectedService || isLoadingRef.current) return;
    const currentKey = `${currentScheduleDate}:${selectedService}`;
    if (loadedDateRef.current !== currentKey) return;

    // Convert local InstrumentSetup to store format
    const storeSetups: Record<string, StoreInstrumentSetup> = {};
    Object.entries(instrumentSetup).forEach(([id, setup]) => {
      storeSetups[id] = {
        enabled: setup.enabled,
        count: setup.count,
      };
    });

    // Preserve existing status - don't overwrite 'published' with 'draft'
    const existingSchedule = getSchedule(currentScheduleDate, selectedService);
    const existingStatus = existingSchedule?.status || 'draft';

    saveSchedule(currentScheduleDate, {
      assignments,
      instrumentSetups: storeSetups,
      status: existingStatus,
    }, selectedService);
  }, [assignments, instrumentSetup, currentScheduleDate, selectedService, saveSchedule, getSchedule]);

  // Get instruments that team members can actually play
  const availableInstruments = instruments.filter(inst =>
    teamMembers.some(m => m.roles.includes(inst.id))
  );

  // Get enabled instruments (that are also available based on team)
  const enabledInstruments = availableInstruments.filter(inst => instrumentSetup[inst.id]?.enabled);

  // Toggle instrument enabled/disabled
  const toggleInstrument = (instrumentId: string) => {
    setInstrumentSetup(prev => {
      const current = prev[instrumentId];
      const inst = instruments.find(i => i.id === instrumentId);
      if (!current || !inst) return prev;

      // If disabling, clear assignments for this instrument
      if (current.enabled) {
        const newAssignments = { ...assignments };
        for (let i = 0; i < current.count; i++) {
          delete newAssignments[`${instrumentId}-${i}`];
        }
        setAssignments(newAssignments);
      }

      return {
        ...prev,
        [instrumentId]: {
          ...current,
          enabled: !current.enabled,
          count: !current.enabled ? (inst.defaultCount || 1) : current.count,
        },
      };
    });
  };

  // Adjust instrument count
  const adjustInstrumentCount = (instrumentId: string, delta: number) => {
    setInstrumentSetup(prev => {
      const current = prev[instrumentId];
      const inst = instruments.find(i => i.id === instrumentId);
      if (!current || !inst) return prev;

      const newCount = Math.max(inst.minCount || 1, Math.min(inst.maxCount, current.count + delta));

      // If reducing count, clear extra assignments
      if (delta < 0) {
        const newAssignments = { ...assignments };
        for (let i = newCount; i < current.count; i++) {
          delete newAssignments[`${instrumentId}-${i}`];
        }
        setAssignments(newAssignments);
      }

      return {
        ...prev,
        [instrumentId]: { ...current, count: newCount },
      };
    });
  };

  // Get assigned member IDs for an instrument (all slots)
  const getAssignedMemberIds = (instrumentId: string): string[] => {
    const ids: string[] = [];
    const setup = instrumentSetup[instrumentId];
    if (!setup) return ids;
    for (let i = 0; i < setup.count; i++) {
      const key = `${instrumentId}-${i}`;
      if (assignments[key]) {
        ids.push(assignments[key]);
      }
    }
    return ids;
  };

  // Open member selection modal
  const openMemberModal = (instrumentId: string, slotIndex: number) => {
    setSelectedInstrumentForModal({ instrumentId, slotIndex });
    setModalVisible(true);
  };

  // Handle member assignment
  const handleAssignMember = (memberId: string) => {
    if (selectedInstrumentForModal) {
      const key = `${selectedInstrumentForModal.instrumentId}-${selectedInstrumentForModal.slotIndex}`;
      setAssignments(prev => ({ ...prev, [key]: memberId }));
    }
  };

  // Handle member removal
  const handleRemoveMember = (instrumentId: string, slotIndex: number) => {
    const key = `${instrumentId}-${slotIndex}`;
    setAssignments(prev => {
      const newAssignments = { ...prev };
      delete newAssignments[key];
      return newAssignments;
    });
  };

  // Add custom instrument
  const addCustomInstrument = (name: string) => {
    const id = `custom_${Date.now()}`;
    const newInst: InstrumentConfig = {
      id,
      name,
      nameEn: name,
      emoji: '🎵',
      minCount: 0,
      maxCount: 4,
      defaultCount: 1,
      defaultEnabled: true,
      isCustom: true,
    };
    setInstruments(prev => [...prev, newInst]);
    setInstrumentSetup(prev => ({
      ...prev,
      [id]: { instrumentId: id, count: 1, enabled: true },
    }));
  };

  // Get member by ID
  const getMemberById = (id: string) => teamMembers.find(m => m.id === id);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (language === 'ko') {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDayOfWeek = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (language === 'ko') {
      const days = ['주일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
      return days[date.getDay()];
    }
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const formatShortDate = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (language === 'ko') {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatShortDayOfWeek = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (language === 'ko') {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return days[date.getDay()];
    }
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const currentDateIndex = getCurrentDateIndex();
  const canGoBack = currentDateIndex > 0;
  const canGoForward = currentDateIndex < sortedDates.length - 1;

  // Generate share message for the schedule
  const generateShareMessage = () => {
    const service = currentServices.find(s => s.id === selectedService);
    const dateObj = currentScheduleDate ? parseLocalDate(currentScheduleDate) : new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];

    let message = `🎵 ${periodTitle || '찬양팀 스케줄'}\n\n`;
    message += `📅 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${days[dateObj.getDay()]})\n`;
    message += `⛪ ${service?.name || '예배'}\n\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `🎼 팀 배정\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;

    enabledInstruments.forEach(inst => {
      const setup = instrumentSetup[inst.id];
      if (!setup?.enabled) return;

      const assignedMembers: string[] = [];
      for (let i = 0; i < (setup.count || 0); i++) {
        const key = `${inst.id}-${i}`;
        const memberId = assignments[key];
        if (memberId) {
          const member = teamMembers.find(m => m.id === memberId);
          if (member) assignedMembers.push(member.name);
        }
      }

      if (assignedMembers.length > 0) {
        message += `${inst.emoji} ${inst.name}: ${assignedMembers.join(', ')}\n`;
      }
    });

    // Add setlist if present
    if (currentSetlist.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `🎵 콘티\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
      currentSetlist.forEach((song, index) => {
        const title = song.title || '(제목 없음)';
        message += `${index + 1}. ${title} (${song.key})`;
        if (song.youtubeUrl) {
          message += `\n   ${song.youtubeUrl}`;
        }
        message += `\n`;
      });
    }

    message += `\n━━━━━━━━━━━━━━━━\n`;
    message += `✨ PraiseFlow에서 확인하세요!`;

    return message;
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    const message = generateShareMessage();
    await Clipboard.setStringAsync(message);
    Alert.alert(
      language === 'ko' ? '복사 완료' : 'Copied',
      language === 'ko' ? '클립보드에 복사되었습니다.\n카카오톡이나 다른 앱에 붙여넣기 하세요.' : 'Copied to clipboard. Paste it in KakaoTalk or other apps.',
      [{ text: 'OK' }]
    );
  };

  // Share using native share
  const handleShare = async () => {
    const message = generateShareMessage();
    try {
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Show preview modal
  const handleConfirmPress = () => {
    setShowPreviewModal(true);
  };

  // Final confirm and send
  const handleFinalConfirm = async () => {
    if (!currentScheduleDate || !teamId || isConfirming) return;

    setIsConfirming(true);

    // Convert local InstrumentSetup to store format
    const storeSetups: Record<string, StoreInstrumentSetup> = {};
    Object.entries(instrumentSetup).forEach(([id, setup]) => {
      storeSetups[id] = {
        enabled: setup.enabled,
        count: setup.count,
      };
    });

    // Save with 'published' status to local store
    saveSchedule(currentScheduleDate, {
      assignments,
      instrumentSetups: storeSetups,
      status: 'published',
    }, selectedService || undefined);

    // Sync to Supabase
    try {
      // Get the service name from the selected service
      const currentServiceObj = currentServices.find(s => s.id === selectedService);
      const serviceName = currentServiceObj?.name;

      // Import API functions dynamically to avoid circular imports
      const { getServiceByDateAndName, getOrCreateRole, syncAssignmentsToSupabase, publishService } = await import('../../../../lib/api');

      // Get the Supabase service ID
      const supabaseService = await getServiceByDateAndName(teamId, currentScheduleDate, serviceName);

      if (supabaseService) {
        console.log('[CreateSchedule] Found Supabase service:', supabaseService.id);

        // Prepare assignments for Supabase
        const supabaseAssignments: { teamMemberId: string; roleId: string }[] = [];

        // Process each assignment
        for (const [key, memberId] of Object.entries(assignments)) {
          if (!memberId) continue;

          // Key format is "instrumentId-slotIndex"
          const [instrumentId] = key.split('-');
          const instrument = instruments.find(i => i.id === instrumentId);

          if (instrument) {
            try {
              // Get or create the role in Supabase
              const role = await getOrCreateRole(
                teamId,
                instrument.nameEn || instrument.name,
                instrument.name,
                instrument.emoji
              );

              supabaseAssignments.push({
                teamMemberId: memberId,
                roleId: role.id,
              });
            } catch (roleErr) {
              console.error('[CreateSchedule] Failed to get/create role:', instrumentId, roleErr);
            }
          }
        }

        // Sync assignments to Supabase
        if (supabaseAssignments.length > 0) {
          await syncAssignmentsToSupabase(supabaseService.id, supabaseAssignments);
          console.log('[CreateSchedule] Synced', supabaseAssignments.length, 'assignments to Supabase');
        }

        // Publish the service
        await publishService(supabaseService.id);
        console.log('[CreateSchedule] Service published:', supabaseService.id);
      } else {
        console.warn('[CreateSchedule] No matching Supabase service found for date:', currentScheduleDate);
      }
    } catch (syncError) {
      console.error('[CreateSchedule] Supabase sync error:', syncError);
      // Continue anyway - local store still works
    }

    console.log('Schedule published for:', currentScheduleDate, selectedService);
    setShowPreviewModal(false);
    setIsConfirming(false);

    Alert.alert(
      language === 'ko' ? '확정 완료!' : 'Confirmed!',
      language === 'ko' ? '스케줄이 확정되었습니다.\n팀원들에게 알림이 전송됩니다.' : 'Schedule confirmed. Team members will be notified.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  // Calculate completion status
  const getTotalAssigned = () => {
    return Object.keys(assignments).length;
  };

  const getTotalSlots = () => {
    return enabledInstruments.reduce((sum, inst) => {
      const setup = instrumentSetup[inst.id];
      return sum + (setup?.count || 0);
    }, 0);
  };

  // No dates selected - show empty state
  if (!hasDates() || sortedDates.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '예배 스케줄 만들기' : 'Create Schedule'}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="calendar-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {language === 'ko' ? '선택된 날짜가 없습니다' : 'No Dates Selected'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {language === 'ko'
              ? '먼저 "찬양 날짜 설정"에서\n예배 날짜를 선택해주세요.'
              : 'Please select worship dates first\nin "Set Worship Dates".'}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/(main)/team/${teamId}/set-dates`)}
          >
            <Ionicons name="calendar" size={20} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>
              {language === 'ko' ? '날짜 설정하기' : 'Set Dates'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {language === 'ko' ? '예배 스케줄 만들기' : 'Create Schedule'}
        </Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            if (!currentScheduleDate || showSaveCheck) return;

            // Convert local InstrumentSetup to store format
            const storeSetups: Record<string, StoreInstrumentSetup> = {};
            Object.entries(instrumentSetup).forEach(([id, setup]) => {
              storeSetups[id] = {
                enabled: setup.enabled,
                count: setup.count,
              };
            });

            // Save with current status (preserve if published, otherwise draft)
            const existingSchedule = getSchedule(currentScheduleDate, selectedService || undefined);
            const status = existingSchedule?.status === 'published' ? 'published' : 'draft';

            saveSchedule(currentScheduleDate, {
              assignments,
              instrumentSetups: storeSetups,
              status,
            }, selectedService || undefined);

            // Show checkmark briefly
            setShowSaveCheck(true);
            setTimeout(() => setShowSaveCheck(false), 1500);
          }}
        >
          {showSaveCheck ? (
            <Ionicons name="checkmark" size={20} color={colors.success} />
          ) : (
            <Text style={[styles.headerButtonText, { color: colors.textSecondary }]}>
              {language === 'ko' ? '임시저장' : 'Save Draft'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Selector */}
      <View style={[styles.dateSelector, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Period Title with Date Count */}
        <View style={styles.dateSelectorHeader}>
          {periodTitle && (
            <Text style={[styles.periodTitle, { color: colors.textSecondary }]}>{periodTitle}</Text>
          )}
          {sortedDates.length > 5 && (
            <View style={[styles.dateCountBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.dateCountBadgeText, { color: colors.primary }]}>
                {currentDateIndex + 1}/{sortedDates.length}
              </Text>
            </View>
          )}
        </View>

        {/* Date Pills - Horizontal Scroll with Fade Indicator */}
        <View style={styles.datePillsWrapper}>
          <ScrollView
            ref={datePillsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datePillsContainer}
            style={styles.datePillsScroll}
            onScroll={(e) => setDatePillsScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          >
            {sortedDates.map((date) => {
              const isSelected = date === currentScheduleDate;
              const isSunday = parseLocalDate(date).getDay() === 0;

              // Get schedule status for this date (use schedules directly for reactivity)
              const dateSchedule = schedules[date];
              const dateStatus = dateSchedule?.status;
              const hasAssignments = dateSchedule && Object.keys(dateSchedule.assignments).length > 0;

              // Determine status color for non-selected dates
              let statusBgColor = colors.background;
              let statusBorderColor = colors.border;
              if (!isSelected) {
                if (dateStatus === 'published') {
                  statusBgColor = colors.success + '20';
                  statusBorderColor = colors.success;
                } else if (hasAssignments || dateStatus === 'complete') {
                  statusBgColor = colors.warning + '20';
                  statusBorderColor = colors.warning;
                }
              }

              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.datePill,
                    {
                      backgroundColor: isSelected ? colors.primary : statusBgColor,
                      borderColor: isSelected ? colors.primary : statusBorderColor,
                    },
                    isSelected && styles.datePillSelected,
                  ]}
                  onPress={() => setCurrentScheduleDate(date)}
                >
                  <Text
                    style={[
                      styles.datePillDay,
                      { color: isSelected ? '#FFFFFF' : (isSunday ? colors.error : colors.textSecondary) },
                    ]}
                  >
                    {formatShortDayOfWeek(date)}
                  </Text>
                  <Text
                    style={[
                      styles.datePillDate,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {formatShortDate(date)}
                  </Text>
                  {isSelected && <View style={styles.datePillIndicator} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Scroll indicator - only show if many dates */}
          {sortedDates.length > 5 && (
            <TouchableOpacity
              style={[styles.scrollIndicatorRight, { backgroundColor: colors.surface }]}
              onPress={scrollDatePillsRight}
              activeOpacity={0.7}
            >
              <View style={[styles.scrollIndicatorArrow, { backgroundColor: colors.textMuted + '20' }]}>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Service Tabs */}
        {currentServices.length > 1 && (
          <View style={[styles.serviceTabs, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {currentServices.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.serviceTab,
                  selectedService === service.id && [styles.serviceTabActive, { backgroundColor: colors.surface }],
                ]}
                onPress={() => setSelectedService(service.id)}
              >
                <Text
                  style={[
                    styles.serviceTabText,
                    { color: selectedService === service.id ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {service.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={Platform.OS === 'ios'}
        extraScrollHeight={Platform.OS === 'ios' ? 80 : 120}
        keyboardShouldPersistTaps="handled"
      >
        {/* Instrument Selection Section */}
        <View style={[styles.instrumentSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header Row */}
          <TouchableOpacity
            style={styles.instrumentSectionHeader}
            onPress={() => setShowAddInstrumentModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.instrumentSectionLeft}>
              <Ionicons name="musical-notes" size={18} color={colors.primary} />
              <Text style={[styles.instrumentSectionTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '필요한 악기 선택' : 'Select Instruments'}
              </Text>
            </View>
            <View style={styles.instrumentSectionRight}>
              <View style={[styles.addInstrumentBtn, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={[styles.addInstrumentText, { color: colors.primary }]}>
                  {language === 'ko' ? '직접 추가' : 'Custom'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>

          {/* Instrument Chips */}
          <ScrollView
            ref={instrumentScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.instrumentChipsContainer}
            onScroll={(e) => setInstrumentScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          >
            {availableInstruments.map((inst) => {
              const setup = instrumentSetup[inst.id];
              const isEnabled = setup?.enabled;
              const count = setup?.count || 0;

              return (
                <TouchableOpacity
                  key={inst.id}
                  style={[
                    styles.instrumentChip,
                    { borderColor: isEnabled ? colors.primary : colors.border },
                    isEnabled && { backgroundColor: colors.primary + '10' },
                  ]}
                  onPress={() => toggleInstrument(inst.id)}
                >
                  <Text style={styles.instrumentChipEmoji}>{inst.emoji}</Text>
                  <Text
                    style={[
                      styles.instrumentChipName,
                      { color: isEnabled ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {language === 'ko' ? inst.name : inst.nameEn}
                  </Text>
                  {isEnabled && (
                    <View style={[styles.instrumentChipCount, { backgroundColor: colors.primary }]}>
                      <Text style={styles.instrumentChipCountText}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Progress Bar */}
        {enabledInstruments.length > 0 && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                {language === 'ko' ? '배정 현황' : 'Progress'}
              </Text>
              <Text style={[styles.progressCount, { color: colors.textPrimary }]}>
                {getTotalAssigned()} / {getTotalSlots()}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${getTotalSlots() > 0 ? (getTotalAssigned() / getTotalSlots()) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Enabled Instruments - Assignment Cards */}
        {enabledInstruments.map((inst) => {
          const setup = instrumentSetup[inst.id];
          if (!setup) return null;

          const assignedCount = getAssignedMemberIds(inst.id).length;
          const isComplete = assignedCount >= setup.count;

          return (
            <View
              key={inst.id}
              style={[styles.instrumentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* Instrument Header */}
              <View style={styles.instrumentCardHeader}>
                <View style={styles.instrumentCardLeft}>
                  <Text style={styles.instrumentCardEmoji}>{inst.emoji}</Text>
                  <Text style={[styles.instrumentCardName, { color: colors.textPrimary }]}>
                    {language === 'ko' ? inst.name : inst.nameEn}
                  </Text>
                  <View
                    style={[
                      styles.instrumentCardBadge,
                      { backgroundColor: isComplete ? colors.success + '15' : colors.primary + '15' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.instrumentCardBadgeText,
                        { color: isComplete ? colors.success : colors.primary },
                      ]}
                    >
                      {assignedCount}/{setup.count}
                    </Text>
                  </View>
                </View>

                {/* Count Stepper */}
                {inst.maxCount > 1 && (
                  <View style={styles.miniStepper}>
                    <TouchableOpacity
                      style={[
                        styles.miniStepperBtn,
                        { backgroundColor: colors.background },
                        setup.count <= (inst.minCount || 1) && styles.miniStepperBtnDisabled,
                      ]}
                      onPress={() => adjustInstrumentCount(inst.id, -1)}
                      disabled={setup.count <= (inst.minCount || 1)}
                    >
                      <Ionicons name="remove" size={14} color={setup.count <= (inst.minCount || 1) ? colors.textMuted : colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.miniStepperValue, { color: colors.textPrimary }]}>{setup.count}</Text>
                    <TouchableOpacity
                      style={[
                        styles.miniStepperBtn,
                        { backgroundColor: colors.background },
                        setup.count >= inst.maxCount && styles.miniStepperBtnDisabled,
                      ]}
                      onPress={() => adjustInstrumentCount(inst.id, 1)}
                      disabled={setup.count >= inst.maxCount}
                    >
                      <Ionicons name="add" size={14} color={setup.count >= inst.maxCount ? colors.textMuted : colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Assignment Slots - Compact Grid */}
              <View style={styles.compactSlotsGrid}>
                {Array(setup.count).fill(0).map((_, slotIndex) => {
                  const key = `${inst.id}-${slotIndex}`;
                  const assignedMemberId = assignments[key];
                  const assignedMember = assignedMemberId ? getMemberById(assignedMemberId) : null;

                  if (assignedMember) {
                    return (
                      <View
                        key={slotIndex}
                        style={[styles.compactAssignedSlot, { backgroundColor: colors.background, borderColor: colors.success + '40' }]}
                      >
                        <View style={[styles.compactAvatar, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.compactAvatarText, { color: colors.primary }]}>
                            {assignedMember.name.charAt(0)}
                          </Text>
                        </View>
                        <Text style={[styles.compactName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {assignedMember.name}
                        </Text>
                        <TouchableOpacity
                          style={styles.compactRemoveBtn}
                          onPress={() => handleRemoveMember(inst.id, slotIndex)}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={slotIndex}
                      style={[styles.compactEmptySlot, { borderColor: colors.border }]}
                      onPress={() => openMemberModal(inst.id, slotIndex)}
                    >
                      <Ionicons name="add" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Empty State */}
        {enabledInstruments.length === 0 && (
          <View style={styles.noInstrumentsState}>
            <Ionicons name="musical-notes-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.noInstrumentsText, { color: colors.textSecondary }]}>
              {language === 'ko' ? '위에서 필요한 악기를 선택하세요' : 'Select instruments above'}
            </Text>
          </View>
        )}

        {/* Setlist Section */}
        {enabledInstruments.length > 0 && (
          <View style={[styles.setlistSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Setlist Header - Collapsible */}
            <TouchableOpacity
              style={styles.setlistHeader}
              onPress={() => setIsSetlistExpanded(!isSetlistExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.setlistHeaderLeft}>
                <Ionicons name="musical-note" size={18} color={colors.primary} />
                <Text style={[styles.setlistHeaderTitle, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '콘티 (곡 목록)' : 'Setlist'}
                </Text>
                {setlistCount > 0 && (
                  <View style={[styles.setlistCountBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.setlistCountText}>{setlistCount}</Text>
                  </View>
                )}
              </View>
              <Ionicons
                name={isSetlistExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Setlist Content */}
            {isSetlistExpanded && (
              <View style={styles.setlistContent}>
                {/* Song List */}
                {currentSetlist.map((song, index) => (
                  <SongInput
                    key={song.id}
                    song={song}
                    index={index}
                    onUpdate={(updates) => currentScheduleDate && updateSong(currentScheduleDate, song.id, updates)}
                    onDelete={() => currentScheduleDate && removeSong(currentScheduleDate, song.id)}
                    onMoveUp={() => currentScheduleDate && index > 0 && reorderSongs(currentScheduleDate, index, index - 1)}
                    onMoveDown={() => currentScheduleDate && index < currentSetlist.length - 1 && reorderSongs(currentScheduleDate, index, index + 1)}
                    isFirst={index === 0}
                    isLast={index === currentSetlist.length - 1}
                  />
                ))}

                {/* Add Song Button */}
                <TouchableOpacity
                  style={[styles.addSongButton, { borderColor: colors.primary }]}
                  onPress={() => {
                    if (currentScheduleDate) {
                      addSong(currentScheduleDate, { title: '', key: 'C' });
                    }
                  }}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={[styles.addSongText, { color: colors.primary }]}>
                    {language === 'ko' ? '곡 추가' : 'Add Song'}
                  </Text>
                </TouchableOpacity>

                {/* Empty State for Setlist */}
                {currentSetlist.length === 0 && (
                  <View style={styles.setlistEmptyState}>
                    <Text style={[styles.setlistEmptyText, { color: colors.textMuted }]}>
                      {language === 'ko' ? '아직 추가된 곡이 없습니다' : 'No songs added yet'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </KeyboardAwareScrollView>

      {/* Member Selection Modal */}
      {selectedInstrumentForModal && (
        <MemberSelectModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSelect={handleAssignMember}
          instrumentId={selectedInstrumentForModal.instrumentId}
          instrumentName={
            language === 'ko'
              ? instruments.find(i => i.id === selectedInstrumentForModal.instrumentId)?.name || ''
              : instruments.find(i => i.id === selectedInstrumentForModal.instrumentId)?.nameEn || ''
          }
          instrumentEmoji={instruments.find(i => i.id === selectedInstrumentForModal.instrumentId)?.emoji || '🎵'}
          assignedMemberIds={getAssignedMemberIds(selectedInstrumentForModal.instrumentId)}
          teamMembers={teamMembers}
          memberAvailability={memberAvailability}
          colors={colors}
          language={language}
        />
      )}

      {/* Add Custom Instrument Modal */}
      <Modal
        visible={showAddInstrumentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddInstrumentModal(false)}
      >
        <View style={styles.addModalOverlay}>
          <View style={[styles.addModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.addModalTitle, { color: colors.textPrimary }]}>
              {language === 'ko' ? '악기 추가' : 'Add Instrument'}
            </Text>
            <View style={[styles.addModalInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.addModalInputText, { color: colors.textPrimary }]}
                placeholder={language === 'ko' ? '악기 이름' : 'Instrument name'}
                placeholderTextColor={colors.textMuted}
                value={newInstrumentName}
                onChangeText={setNewInstrumentName}
              />
            </View>
            <View style={styles.addModalButtons}>
              <TouchableOpacity
                style={[styles.addModalCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setNewInstrumentName('');
                  setShowAddInstrumentModal(false);
                }}
              >
                <Text style={[styles.addModalCancelText, { color: colors.textSecondary }]}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addModalConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (newInstrumentName.trim()) {
                    addCustomInstrument(newInstrumentName.trim());
                    setNewInstrumentName('');
                    setShowAddInstrumentModal(false);
                  }
                }}
              >
                <Text style={styles.addModalConfirmText}>
                  {language === 'ko' ? '추가' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.primary }]}
          onPress={handleConfirmPress}
        >
          <Text style={styles.confirmButtonText}>
            {language === 'ko' ? '예배 확정 및 알림 보내기' : 'Confirm & Send Notifications'}
          </Text>
          <Ionicons name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Preview/Confirmation Modal */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => !isConfirming && setShowPreviewModal(false)}
      >
        <View style={styles.previewModalOverlay}>
          <View style={[styles.previewModalContent, { backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={[styles.previewModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.previewModalTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '스케줄 미리보기' : 'Schedule Preview'}
              </Text>
              <TouchableOpacity
                style={[styles.previewModalClose, isConfirming && { opacity: 0.5 }]}
                onPress={() => !isConfirming && setShowPreviewModal(false)}
                disabled={isConfirming}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Preview Content */}
            <ScrollView style={styles.previewScrollView} showsVerticalScrollIndicator={false}>
              {/* Date & Service Info */}
              <View style={[styles.previewInfoCard, { backgroundColor: colors.background }]}>
                <View style={styles.previewInfoRow}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                  <Text style={[styles.previewInfoText, { color: colors.textPrimary }]}>
                    {currentScheduleDate && formatDate(currentScheduleDate)}
                  </Text>
                </View>
                <View style={styles.previewInfoRow}>
                  <Ionicons name="musical-note" size={18} color={colors.primary} />
                  <Text style={[styles.previewInfoText, { color: colors.textPrimary }]}>
                    {currentServices.find(s => s.id === selectedService)?.name}
                  </Text>
                </View>
              </View>

              {/* Team Assignments Preview */}
              <Text style={[styles.previewSectionTitle, { color: colors.textPrimary }]}>
                {language === 'ko' ? '팀 배정 현황' : 'Team Assignments'}
              </Text>

              {enabledInstruments.map(inst => {
                const setup = instrumentSetup[inst.id];
                if (!setup?.enabled) return null;

                const assignedMembers: { name: string; status: string }[] = [];
                for (let i = 0; i < (setup.count || 0); i++) {
                  const key = `${inst.id}-${i}`;
                  const memberId = assignments[key];
                  if (memberId) {
                    const member = teamMembers.find(m => m.id === memberId);
                    if (member) {
                      assignedMembers.push({ name: member.name, status: memberAvailability[member.id] || 'pending' });
                    }
                  }
                }

                if (assignedMembers.length === 0) return null;

                return (
                  <View key={inst.id} style={[styles.previewRoleCard, { backgroundColor: colors.background }]}>
                    <View style={styles.previewRoleHeader}>
                      <Text style={styles.previewRoleEmoji}>{inst.emoji}</Text>
                      <Text style={[styles.previewRoleName, { color: colors.textPrimary }]}>
                        {language === 'ko' ? inst.name : inst.nameEn}
                      </Text>
                    </View>
                    <View style={styles.previewMembersList}>
                      {assignedMembers.map((member, idx) => (
                        <View key={idx} style={styles.previewMemberItem}>
                          <View style={[styles.previewMemberDot, { backgroundColor: colors.primary }]} />
                          <Text style={[styles.previewMemberName, { color: colors.textSecondary }]}>
                            {member.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}

              {/* Setlist Preview */}
              {currentSetlist.length > 0 && (
                <>
                  <Text style={[styles.previewSectionTitle, { color: colors.textPrimary, marginTop: spacing.lg }]}>
                    {language === 'ko' ? '콘티 (곡 목록)' : 'Setlist'}
                  </Text>
                  <View style={[styles.previewSetlistCard, { backgroundColor: colors.background }]}>
                    {currentSetlist.map((song, index) => (
                      <View key={song.id} style={styles.previewSetlistItem}>
                        <Text style={[styles.previewSetlistNumber, { color: colors.textMuted }]}>
                          {index + 1}.
                        </Text>
                        <Text style={[styles.previewSetlistTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {song.title || (language === 'ko' ? '(제목 없음)' : '(Untitled)')}
                        </Text>
                        <Text style={[styles.previewSetlistKey, { backgroundColor: colors.primary + '15', color: colors.primary }]}>
                          {song.key}
                        </Text>
                        {song.youtubeUrl && (
                          <TouchableOpacity
                            style={styles.previewSetlistLink}
                            onPress={() => Linking.openURL(song.youtubeUrl!)}
                          >
                            <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Share Preview */}
              <View style={[styles.sharePreviewCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
                <Text style={[styles.sharePreviewLabel, { color: colors.textSecondary }]}>
                  {language === 'ko' ? '공유 메시지 미리보기' : 'Share Message Preview'}
                </Text>
                <Text style={[styles.sharePreviewText, { color: colors.textPrimary }]}>
                  {generateShareMessage()}
                </Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.previewActions, { borderTopColor: colors.border }]}>
              {/* Share Options Row */}
              <View style={styles.shareButtonsRow}>
                <TouchableOpacity
                  style={[styles.shareButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handleCopyToClipboard}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
                  <Text style={[styles.shareButtonText, { color: colors.textPrimary }]}>
                    {language === 'ko' ? '복사' : 'Copy'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handleShare}
                >
                  <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
                  <Text style={[styles.shareButtonText, { color: colors.textPrimary }]}>
                    {language === 'ko' ? '공유' : 'Share'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={[
                  styles.previewConfirmButton,
                  { backgroundColor: colors.primary },
                  isConfirming && { opacity: 0.7 }
                ]}
                onPress={handleFinalConfirm}
                disabled={isConfirming}
                activeOpacity={0.8}
              >
                {isConfirming ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.previewConfirmText}>
                      {language === 'ko' ? '전송 중...' : 'Sending...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.previewConfirmText}>
                      {language === 'ko' ? '확정 및 알림 보내기' : 'Confirm & Notify'}
                    </Text>
                  </>
                )}
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
    backgroundColor: staticColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  // Date Selector
  dateSelector: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  dateSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  periodTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  dateCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  dateCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  datePillsWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  datePillsScroll: {
  },
  datePillsContainer: {
    paddingHorizontal: spacing.lg,
    paddingRight: 48,
    gap: spacing.sm,
  },
  // Scroll Indicator
  scrollIndicatorRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: spacing.xs,
  },
  scrollIndicatorArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePill: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minWidth: 56,
  },
  datePillSelected: {
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  datePillDay: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: 2,
  },
  datePillDate: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  datePillIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  dateNavButton: {
    padding: spacing.sm,
  },
  dateNavButtonDisabled: {
    opacity: 0.3,
  },
  dateInfo: {
    alignItems: 'center',
    minWidth: 180,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
  },
  dayOfWeek: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  dateProgress: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateProgressText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  serviceTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    padding: 6,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  serviceTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  serviceTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceTabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Progress Card
  progressCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Role Card
  roleCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  roleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEmoji: {
    fontSize: 22,
  },
  roleInfo: {
    gap: 4,
  },
  roleName: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    fontSize: fontSize.base,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  // Slots
  slotsContainer: {
    padding: spacing.md,
    paddingTop: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  assignedSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  slotAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotAvatarText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  slotName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    maxWidth: 80,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  emptySlotText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  // Instrument Selection Section
  instrumentSection: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  instrumentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  instrumentSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  instrumentSectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instrumentSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  instrumentSectionHint: {
    fontSize: 10,
    fontWeight: '500',
  },
  addInstrumentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  addInstrumentText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  instrumentChipsContainer: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  instrumentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    gap: 4,
  },
  instrumentChipEmoji: {
    fontSize: 14,
  },
  instrumentChipName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  instrumentChipCount: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  instrumentChipCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instrumentChipAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 4,
  },
  instrumentChipAddText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  scrollFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
  },
  scrollMoreText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  // Instrument Card
  instrumentCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  instrumentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  instrumentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  instrumentCardEmoji: {
    fontSize: 18,
  },
  instrumentCardName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  instrumentCardBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  instrumentCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Mini Stepper
  miniStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  miniStepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStepperBtnDisabled: {
    opacity: 0.3,
  },
  miniStepperValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  // Compact Slots Grid
  compactSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  compactAssignedSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  compactAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAvatarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  compactName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    maxWidth: 60,
  },
  compactRemoveBtn: {
    padding: 2,
  },
  compactEmptySlot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No Instruments State
  noInstrumentsState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  noInstrumentsText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  // Add Instrument Modal
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  addModalContent: {
    width: '100%',
    maxWidth: 300,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  addModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  addModalInput: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  addModalInputText: {
    fontSize: fontSize.base,
  },
  addModalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addModalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  addModalCancelText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  addModalConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  addModalConfirmText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 120,
  },
  // Compact Date Header
  compactDateHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 0.5,
  },
  dateNavCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  dateNavBtnCompact: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dateInfoCompact: {
    flex: 1,
    alignItems: 'center',
  },
  dateTextCompact: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  dateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  dayOfWeekCompact: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  // Mini Date Pills
  miniDatePillsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    flexDirection: 'row',
  },
  miniDatePill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDatePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Compact Service Tabs
  serviceTabsCompact: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  serviceTabCompact: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  serviceTabTextCompact: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  // Collapsible Instrument Header
  instrumentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  instrumentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  instrumentHeaderTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  instrumentCountPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  instrumentCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  instrumentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  instrumentMiniPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  instrumentMiniEmoji: {
    fontSize: 14,
  },
  instrumentMiniMore: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  instrumentExpanded: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingVertical: spacing.sm,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    borderRadius: borderRadius.lg,
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  // Preview Modal Styles
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  previewModalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  previewModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  previewModalClose: {
    padding: spacing.xs,
  },
  previewScrollView: {
    padding: spacing.lg,
  },
  previewInfoCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  previewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewInfoText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  previewSectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  previewRoleCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  previewRoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  previewRoleEmoji: {
    fontSize: 18,
  },
  previewRoleName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  previewMembersList: {
    gap: spacing.xs,
  },
  previewMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
  },
  previewMemberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewMemberName: {
    fontSize: fontSize.sm,
  },
  sharePreviewCard: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  sharePreviewLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  sharePreviewText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  previewActions: {
    borderTopWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  shareButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  previewConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  previewConfirmText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  // Setlist Section
  setlistSection: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  setlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  setlistHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setlistHeaderTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  setlistCountBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setlistCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  setlistContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  addSongButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
  },
  addSongText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  setlistEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  setlistEmptyText: {
    fontSize: fontSize.sm,
  },
  // Preview Setlist
  previewSetlistCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  previewSetlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  previewSetlistNumber: {
    width: 20,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  previewSetlistTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  previewSetlistKey: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  previewSetlistLink: {
    padding: spacing.xs,
  },
});
