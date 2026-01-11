/**
 * Dates Overview Screen - NativeWind Version
 *
 * Shows confirmed/published services with participant details.
 * Share functionality includes only published services with assignments.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Share,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { useSchedulingStore } from '../../../../store/schedulingStore';
import { useServiceTypeStore } from '../../../../store/serviceTypeStore';
import { useTeamStore } from '../../../../store/teamStore';
import { useSafeNavigation } from '../../../../hooks/useNavigation';
import { supabase } from '../../../../lib/supabase';

// Instrument definitions for resolving local assignments
const INSTRUMENTS = [
  { id: 'leader', name: 'Leader', nameKo: '인도자' },
  { id: 'keyboard', name: 'Keyboard', nameKo: '건반' },
  { id: 'drums', name: 'Drums', nameKo: '드럼' },
  { id: 'electric', name: 'E.Guitar', nameKo: '일렉기타' },
  { id: 'bass', name: 'Bass', nameKo: '베이스' },
  { id: 'acoustic', name: 'Acoustic', nameKo: '어쿠스틱' },
  { id: 'violin', name: 'Violin', nameKo: '바이올린' },
  { id: 'vocals', name: 'Vocals', nameKo: '싱어' },
];
import { getTeamServices, getServiceById } from '../../../../lib/api/services';
import { ServiceWithAssignments } from '../../../../types/database.types';
import ShareTableImage, { ShareTableImageRef } from '../../../../components/ShareTableImage';
import * as Sharing from 'expo-sharing';

const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

type ServiceStatus = 'not_started' | 'in_progress' | 'complete' | 'published';

interface AssignmentInfo {
  memberName: string;
  roleName: string;
  status: string;
}

interface ServiceInfo {
  id: string;
  supabaseId?: string; // Actual Supabase service ID
  name: string;
  serviceTime?: string;
  assignmentsCount: number;
  status: ServiceStatus;
  assignments?: AssignmentInfo[];
}

interface DateGroup {
  date: string;
  services: ServiceInfo[];
}

export default function DatesOverviewScreen() {
  const router = useRouter();
  const { safeGoBack } = useSafeNavigation();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { selectedDates, periodTitle, getSchedule } = useSchedulingStore();
  const { getServiceTypes } = useServiceTypeStore();
  const serviceTypes = getServiceTypes(teamId || '');
  const { teams } = useTeamStore();
  const team = teams.find(t => t.id === teamId);

  // Team members fetched from Supabase
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; nickname: string | null; user: { full_name: string | null } | null }>>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const days = language === 'ko' ? ['일', '월', '화', '수', '목', '금', '토'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [shareMode, setShareMode] = useState<'text' | 'image'>('text');
  const shareTableRef = useRef<ShareTableImageRef>(null);

  // Fetched services with full assignment details - use service ID as key, not date
  const [publishedServicesMap, setPublishedServicesMap] = useState<Map<string, ServiceWithAssignments>>(new Map());
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Fetch team members from Supabase
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!teamId) return;

      try {
        const { data, error } = await supabase
          .from('team_members')
          .select(`
            id,
            nickname,
            user:users!team_members_user_id_fkey (
              full_name
            )
          `)
          .eq('team_id', teamId)
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching team members:', error);
          return;
        }

        setTeamMembers(data || []);
      } catch (err) {
        console.error('Error fetching team members:', err);
      }
    };

    fetchTeamMembers();
  }, [teamId]);

  // Fetch published services function
  const fetchPublishedServices = useCallback(async () => {
    if (!teamId) return;

    setIsLoadingServices(true);
    try {
      // Get all published services for the team
      const services = await getTeamServices(teamId, {
        status: 'published',
        includePast: true,
      });

      // Fetch full details with assignments for each published service
      // Use service ID as key to handle multiple services on same date
      const servicesWithDetails = new Map<string, ServiceWithAssignments>();

      await Promise.all(
        services.map(async (service) => {
          try {
            const fullService = await getServiceById(service.id);
            // Use service ID as key, not date
            servicesWithDetails.set(service.id, fullService);
          } catch (err) {
            console.error('Error fetching service details:', err);
          }
        })
      );

      setPublishedServicesMap(servicesWithDetails);
    } catch (err) {
      console.error('Error fetching published services:', err);
    } finally {
      setIsLoadingServices(false);
    }
  }, [teamId]);

  // Fetch on mount and when screen is focused (after returning from create-schedule)
  useFocusEffect(
    useCallback(() => {
      fetchPublishedServices();
    }, [fetchPublishedServices])
  );

  // Helper to get emoji for instrument/role
  const getInstrumentEmoji = useCallback((roleName: string): string => {
    const lower = roleName.toLowerCase();
    if (lower.includes('vocal') || lower.includes('보컬') || lower.includes('싱어')) return '🎤';
    if (lower.includes('guitar') || lower.includes('기타')) return '🎸';
    if (lower.includes('drum') || lower.includes('드럼')) return '🥁';
    if (lower.includes('bass') || lower.includes('베이스')) return '🎸';
    if (lower.includes('piano') || lower.includes('피아노') || lower.includes('키보드') || lower.includes('keyboard')) return '🎹';
    if (lower.includes('worship') || lower.includes('인도자') || lower.includes('leader')) return '🙏';
    return '🎵';
  }, []);

  // Get published service for a specific date AND service name from Supabase data
  const getPublishedServiceForDateAndName = useCallback((dateStr: string, serviceName: string): ServiceWithAssignments | undefined => {
    // Find service matching both date AND name
    // Service name format is "M/D ServiceTypeName", so we need to check if the type name matches
    for (const [, service] of publishedServicesMap) {
      if (service.service_date !== dateStr) continue;

      // Extract service type name from full service name (e.g., "1/11 2부" -> "2부")
      const nameParts = service.name.split(' ');
      const serviceTypeName = nameParts.slice(1).join(' ') || service.name;

      // Check if service type name matches
      if (serviceTypeName === serviceName || service.name === serviceName) {
        return service;
      }
    }
    return undefined;
  }, [publishedServicesMap]);

  // Helper to resolve local store assignments to participant names
  const resolveLocalAssignments = useCallback((schedule: any): AssignmentInfo[] => {
    if (!schedule?.assignments) return [];

    const assignments: AssignmentInfo[] = [];
    const assignmentEntries = Object.entries(schedule.assignments);

    assignmentEntries.forEach(([key, memberId]) => {
      if (!memberId || typeof memberId !== 'string') return;

      // Key format: "instrumentId-slotIndex"
      const [instrumentId] = key.split('-');

      // Find member name from fetched team members
      const member = teamMembers.find(m => m.id === memberId);
      const memberName = member?.nickname || member?.user?.full_name || 'Unknown';

      // Find instrument/role name
      const instrument = INSTRUMENTS.find(i => i.id === instrumentId);
      const roleName = language === 'ko' ? (instrument?.nameKo || instrument?.name || instrumentId) : (instrument?.name || instrumentId);

      assignments.push({
        memberName,
        roleName,
        status: 'confirmed',
      });
    });

    return assignments;
  }, [teamMembers, language]);

  // Combine selectedDates with dates from publishedServicesMap to include ad-hoc services
  const allDatesSet = new Set(selectedDates);
  for (const [, service] of publishedServicesMap) {
    allDatesSet.add(service.service_date);
  }
  const sortedDates = [...allDatesSet].sort();

  const dateGroups: DateGroup[] = sortedDates.map((date) => {
    const dayOfWeek = parseLocalDate(date).getDay();
    const matchingTypes = serviceTypes.filter((t) => t.defaultDay === dayOfWeek);

    const services: ServiceInfo[] = matchingTypes.map((t) => {
      const serviceId = `${date}-${t.id}`;
      const schedule = getSchedule(date, serviceId);
      const assignmentCount = schedule ? Object.keys(schedule.assignments).length : 0;

      // Check if there's a published service for this date AND service type from Supabase
      const publishedService = getPublishedServiceForDateAndName(date, t.name);

      // Extract assignment details - first try Supabase, then fall back to local store
      let assignments: AssignmentInfo[] | undefined;
      if (publishedService && publishedService.assignments && publishedService.assignments.length > 0) {
        // Use Supabase assignments
        assignments = publishedService.assignments.map((a: any) => ({
          memberName: a.team_member?.user?.full_name || a.team_member?.nickname || 'Unknown',
          roleName: language === 'ko' && a.role?.name_ko ? a.role.name_ko : a.role?.name || 'Unknown',
          status: a.status || 'pending',
        }));
      } else if (schedule && Object.keys(schedule.assignments).length > 0) {
        // Fall back to local store assignments
        assignments = resolveLocalAssignments(schedule);
      }

      const finalAssignmentCount = assignments?.length || publishedService?.assignments?.length || assignmentCount;

      // Determine status - CANNOT be confirmed/published if no assignments
      let status: ServiceStatus = 'not_started';
      const hasAssignments = finalAssignmentCount > 0;

      if (hasAssignments && (publishedService || schedule?.status === 'published')) {
        status = 'published'; // Only published if has assignments
      } else if (hasAssignments && schedule?.status === 'complete') {
        status = 'complete';
      } else if (hasAssignments) {
        status = 'in_progress';
      } else {
        status = 'not_started'; // No assignments = not started
      }

      return {
        id: serviceId,
        supabaseId: publishedService?.id,
        name: t.name,
        serviceTime: t.serviceTime,
        assignmentsCount: finalAssignmentCount,
        status,
        assignments,
      };
    });

    // Add truly ad-hoc services from Supabase (custom services that don't match any service type)
    // Exclude services that match ANY service type (even on wrong day) - those are likely bugs
    const matchingTypeNames = matchingTypes.map(t => t.name);
    const allServiceTypeNames = serviceTypes.map(t => t.name);
    for (const [, service] of publishedServicesMap) {
      if (service.service_date !== date) continue;

      // Extract service type name from service name (format: "M/D ServiceTypeName")
      const parts = service.name.split(' ');
      const serviceTypeName = parts.slice(1).join(' ') || service.name;

      // Skip if this service matches a service type for THIS DAY (already shown above)
      if (matchingTypeNames.some(name => name === serviceTypeName)) continue;

      // Skip if this service matches ANY service type (wrong day = likely a bug, not truly ad-hoc)
      if (allServiceTypeNames.includes(serviceTypeName)) continue;

      // This is a truly ad-hoc service - add it to the list
      const adhocAssignments: AssignmentInfo[] | undefined = service.assignments && service.assignments.length > 0
        ? service.assignments.map((a: any) => ({
            memberName: a.team_member?.user?.full_name || a.team_member?.nickname || 'Unknown',
            roleName: language === 'ko' && a.role?.name_ko ? a.role.name_ko : a.role?.name || 'Unknown',
            status: a.status || 'pending',
          }))
        : undefined;

      const finalAssignmentCount = adhocAssignments?.length || service.assignments?.length || 0;
      let status: ServiceStatus = 'not_started';
      const hasAssignments = finalAssignmentCount > 0;

      if (hasAssignments && service.status === 'published') {
        status = 'published';
      } else if (hasAssignments) {
        status = 'in_progress';
      }

      services.push({
        id: `${date}-adhoc-${service.id}`,
        supabaseId: service.id,
        name: serviceTypeName || service.name,
        serviceTime: service.start_time || undefined,
        assignmentsCount: finalAssignmentCount,
        status,
        assignments: adhocAssignments,
      });
    }

    if (services.length === 0) {
      services.push({
        id: `${date}-default`,
        name: language === 'ko' ? '예배' : 'Service',
        assignmentsCount: 0,
        status: 'not_started',
      });
    }

    return { date, services };
  });

  const totalServices = dateGroups.reduce((acc, d) => acc + d.services.length, 0);
  const publishedCount = dateGroups.reduce((acc, d) => acc + d.services.filter((s) => s.status === 'published').length, 0);
  const inProgressCount = dateGroups.reduce((acc, d) => acc + d.services.filter((s) => s.status === 'in_progress').length, 0);
  const notStartedCount = dateGroups.reduce((acc, d) => acc + d.services.filter((s) => s.status === 'not_started').length, 0);

  const getStatusConfig = (status: ServiceStatus) => {
    switch (status) {
      case 'published':
        return { icon: 'checkmark-circle' as const, color: colors.success, text: language === 'ko' ? '확정' : 'Confirmed' };
      case 'complete':
        return { icon: 'checkmark-done' as const, color: colors.success, text: language === 'ko' ? '완료' : 'Complete' };
      case 'in_progress':
        return { icon: 'time' as const, color: colors.warning, text: language === 'ko' ? '진행중' : 'In Progress' };
      default:
        return { icon: 'ellipse-outline' as const, color: colors.textMuted, text: language === 'ko' ? '미시작' : 'Not Started' };
    }
  };

  // Format date for sharing
  const formatDateForShare = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    if (language === 'ko') {
      return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]}요일)`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  // Share a single date's schedule (only published with participant details)
  const shareDate = useCallback(async (group: DateGroup) => {
    // Only share published services
    const publishedServices = group.services.filter(s => s.status === 'published');

    if (publishedServices.length === 0) {
      Alert.alert(
        language === 'ko' ? '공유할 일정 없음' : 'No Schedule to Share',
        language === 'ko' ? '이 날짜에 확정된 일정이 없습니다.' : 'No confirmed schedule for this date.'
      );
      return;
    }

    const teamName = team?.name || (language === 'ko' ? '찬양팀' : 'Worship Team');
    const dateStr = formatDateForShare(group.date);

    let message = language === 'ko'
      ? `📅 ${teamName} - ${dateStr} 일정\n\n`
      : `📅 ${teamName} - ${dateStr} Schedule\n\n`;

    publishedServices.forEach(service => {
      message += `🎵 ${service.name}`;
      if (service.serviceTime) message += ` (${service.serviceTime})`;
      message += `\n`;

      // Include participant details
      if (service.assignments && service.assignments.length > 0) {
        message += language === 'ko' ? `\n👥 참여자:\n` : `\n👥 Participants:\n`;
        service.assignments.forEach(assignment => {
          message += `   • ${assignment.memberName} - ${assignment.roleName}\n`;
        });
      } else {
        message += language === 'ko' ? `   (배정된 멤버 없음)\n` : `   (No members assigned)\n`;
      }
      message += `\n`;
    });

    message += language === 'ko'
      ? `🙏 이번 주도 함께 찬양할 수 있길 기대합니다!`
      : `🙏 Looking forward to worshipping together!`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [team, language, days]);

  // Generate message for sharing all dates (only published with participant details)
  const generateShareAllMessage = useCallback(() => {
    // Filter to only dates that have published services
    const publishedDateGroups = dateGroups
      .map(group => ({
        ...group,
        services: group.services.filter(s => s.status === 'published'),
      }))
      .filter(group => group.services.length > 0);

    if (publishedDateGroups.length === 0) {
      return null; // No published services to share
    }

    const teamName = team?.name || (language === 'ko' ? '찬양팀' : 'Worship Team');
    const title = periodTitle || (language === 'ko' ? '이번 달 일정' : 'This Month Schedule');

    let message = language === 'ko'
      ? `📋 ${teamName} - ${title}\n\n`
      : `📋 ${teamName} - ${title}\n\n`;

    const totalPublishedServices = publishedDateGroups.reduce((acc, g) => acc + g.services.length, 0);
    message += language === 'ko'
      ? `확정된 일정: ${totalPublishedServices}개\n`
      : `Confirmed: ${totalPublishedServices}\n`;
    message += `${'─'.repeat(25)}\n\n`;

    publishedDateGroups.forEach(group => {
      const dateStr = formatDateForShare(group.date);
      message += `📅 ${dateStr}\n`;

      group.services.forEach(service => {
        message += `\n🎵 ${service.name}`;
        if (service.serviceTime) message += ` (${service.serviceTime})`;
        message += `\n`;

        // Include participant details - THIS IS THE KEY FIX
        if (service.assignments && service.assignments.length > 0) {
          message += language === 'ko' ? `👥 참여자:\n` : `👥 Participants:\n`;
          service.assignments.forEach(assignment => {
            message += `   • ${assignment.memberName} - ${assignment.roleName}\n`;
          });
        } else {
          message += language === 'ko' ? `   (배정 대기 중)\n` : `   (Assignments pending)\n`;
        }
      });
      message += `\n`;
    });

    message += language === 'ko'
      ? `🙏 이번 달도 함께 찬양할 수 있길 기대합니다!\n하나님께서 우리의 예배를 받으시길 기도합니다.`
      : `🙏 Looking forward to worshipping together this month!\nMay God bless our worship.`;

    return message;
  }, [dateGroups, team, periodTitle, language, days]);

  // Show preview before sharing all
  const showSharePreview = useCallback(() => {
    if (dateGroups.length === 0) {
      Alert.alert(
        language === 'ko' ? '공유할 일정 없음' : 'No Schedule to Share',
        language === 'ko' ? '설정된 날짜가 없습니다.' : 'No dates have been set.'
      );
      return;
    }

    const message = generateShareAllMessage();
    if (!message) {
      Alert.alert(
        language === 'ko' ? '공유할 일정 없음' : 'No Schedule to Share',
        language === 'ko' ? '확정된 일정이 없습니다. 먼저 일정을 확정해주세요.' : 'No confirmed schedules. Please confirm schedules first.'
      );
      return;
    }
    setPreviewMessage(message);
    setShowPreview(true);
  }, [dateGroups.length, language, generateShareAllMessage]);

  // Actually share after preview
  const confirmShare = useCallback(async () => {
    setShowPreview(false);
    try {
      await Share.share({ message: previewMessage });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [previewMessage]);

  // Share as image
  const confirmShareImage = useCallback(async () => {
    setShowPreview(false);
    try {
      if (shareTableRef.current) {
        const uri = await shareTableRef.current.capture();
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: language === 'ko' ? '일정 이미지 공유' : 'Share Schedule Image',
          });
        } else {
          Alert.alert(
            language === 'ko' ? '공유 불가' : 'Sharing Unavailable',
            language === 'ko' ? '이 기기에서는 이미지 공유가 지원되지 않습니다.' : 'Image sharing is not available on this device.'
          );
        }
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert(
        language === 'ko' ? '오류' : 'Error',
        language === 'ko' ? '이미지 공유 중 오류가 발생했습니다.' : 'An error occurred while sharing the image.'
      );
    }
  }, [language]);

  // Prepare data for ShareTableImage (only published services with assignments)
  const imageShareData = useMemo(() => {
    const publishedDateGroups = dateGroups
      .map(group => ({
        ...group,
        services: group.services.filter(s => s.status === 'published'),
      }))
      .filter(group => group.services.length > 0);

    const dates = publishedDateGroups.map(g => g.date);

    // Create member assignment map
    const memberMap = new Map<string, {
      name: string;
      instrument: string;
      instrumentEmoji: string;
      instrumentName: string;
      dates: Set<string>;
    }>();

    publishedDateGroups.forEach(group => {
      group.services.forEach(service => {
        if (service.assignments) {
          service.assignments.forEach(assignment => {
            const key = `${assignment.memberName}-${assignment.roleName}`;
            if (!memberMap.has(key)) {
              const emoji = getInstrumentEmoji(assignment.roleName);
              memberMap.set(key, {
                name: assignment.memberName,
                instrument: assignment.roleName,
                instrumentEmoji: emoji,
                instrumentName: assignment.roleName,
                dates: new Set([group.date]),
              });
            } else {
              memberMap.get(key)!.dates.add(group.date);
            }
          });
        }
      });
    });

    const members = Array.from(memberMap.values());
    const teamName = team?.name || (language === 'ko' ? '찬양팀' : 'Worship Team');
    const title = `${teamName} - ${periodTitle || (language === 'ko' ? '이번 달 일정' : 'Schedule')}`;

    return { title, dates, members };
  }, [dateGroups, team, periodTitle, language, getInstrumentEmoji]);

  if (isLoadingServices) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: 15 }}>
            {language === 'ko' ? '일정 불러오는 중...' : 'Loading schedules...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => safeGoBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary, flex: 1, textAlign: 'center' }}>
          {periodTitle || (language === 'ko' ? '일정 현황' : 'Schedule Status')}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={showSharePreview}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.push(`/(main)/team/${teamId}/set-dates`)}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 12 }}>
        {[
          { value: totalServices, label: language === 'ko' ? '전체' : 'Total', color: colors.textPrimary },
          { value: publishedCount, label: language === 'ko' ? '확정' : 'Confirmed', color: colors.success },
          { value: inProgressCount, label: language === 'ko' ? '진행중' : 'Progress', color: colors.warning },
          { value: notStartedCount, label: language === 'ko' ? '미시작' : 'Pending', color: colors.textMuted },
        ].map((stat, i, arr) => (
          <View
            key={stat.label}
            style={[
              { flex: 1, alignItems: 'center' },
              i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border }
            ]}
          >
            <Text style={{ fontSize: 24, fontWeight: '700', color: stat.color }}>{stat.value}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {dateGroups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="calendar-outline" size={32} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>
                {language === 'ko' ? '설정된 날짜가 없습니다' : 'No dates set'}
              </Text>
              <TouchableOpacity
                style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 12 }}
                onPress={() => router.push(`/(main)/team/${teamId}/set-dates`)}
              >
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>{language === 'ko' ? '날짜 설정하기' : 'Set Dates'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dateGroups.map((group) => {
              const dateObj = parseLocalDate(group.date);
              const isSunday = dateObj.getDay() === 0;
              const isSaturday = dateObj.getDay() === 6;
              const dateColor = isSunday ? colors.error : isSaturday ? colors.info : colors.primary;

              return (
                <View key={group.date} style={{ marginBottom: 16 }}>
                  {/* Date Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                    <View
                      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: dateColor }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{dateObj.getDate()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: isSunday ? colors.error : colors.textPrimary }}>
                        {dateObj.getMonth() + 1}월 {dateObj.getDate()}일
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {days[dateObj.getDay()]}{language === 'ko' ? '요일' : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '15' }}
                      onPress={() => shareDate(group)}
                    >
                      <Ionicons name="share-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Service Cards */}
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                    {group.services.map((service, idx) => {
                      const statusConfig = getStatusConfig(service.status);
                      const isLast = idx === group.services.length - 1;

                      return (
                        <TouchableOpacity
                          key={service.id}
                          style={[
                            { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 12 },
                            !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }
                          ]}
                          onPress={() => router.push(`/(main)/team/${teamId}/create-schedule?date=${group.date}&service=${service.id}`)}
                          activeOpacity={0.6}
                        >
                          {/* Status Line */}
                          <View style={{ width: 4, height: 32, borderRadius: 2, marginHorizontal: 12, backgroundColor: statusConfig.color }} />

                          {/* Service Info */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{service.name}</Text>
                            {service.serviceTime && (
                              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{service.serviceTime}</Text>
                            )}
                            {/* Show participant names if published */}
                            {service.status === 'published' && service.assignments && service.assignments.length > 0 && (
                              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }} numberOfLines={1}>
                                {service.assignments.slice(0, 3).map(a => a.memberName).join(', ')}
                                {service.assignments.length > 3 && ` +${service.assignments.length - 3}`}
                              </Text>
                            )}
                          </View>

                          {/* Assignment Count */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10 }}>
                            <Ionicons
                              name="people"
                              size={12}
                              color={service.assignmentsCount > 0 ? colors.primary : colors.textMuted}
                            />
                            <Text style={{ fontSize: 11, fontWeight: '500', color: service.assignmentsCount > 0 ? colors.primary : colors.textMuted }}>
                              {service.assignmentsCount || '-'}
                            </Text>
                          </View>

                          {/* Status Badge */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4, marginRight: 6, backgroundColor: statusConfig.color + '18' }}>
                            <Ionicons name={statusConfig.icon} size={11} color={statusConfig.color} />
                            <Text style={{ fontSize: 10, fontWeight: '600', color: statusConfig.color }}>
                              {statusConfig.text}
                            </Text>
                          </View>

                          {/* Chevron */}
                          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom Buttons */}
      {dateGroups.length > 0 && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 2, gap: 8, borderColor: colors.primary }}
              onPress={showSharePreview}
            >
              <Ionicons name="share-outline" size={18} color={colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>
                {language === 'ko' ? '전체 공유' : 'Share All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, gap: 8, backgroundColor: colors.primary }}
              onPress={() => router.push(`/(main)/team/${teamId}/set-dates`)}
            >
              <Ionicons name="calendar" size={18} color="#FFF" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{language === 'ko' ? '날짜 수정' : 'Edit Dates'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Share Preview Modal */}
      <Modal
        visible={showPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>
                {language === 'ko' ? '공유 미리보기' : 'Share Preview'}
              </Text>
              <TouchableOpacity
                style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowPreview(false)}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Share Mode Selector */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
              <TouchableOpacity
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 6 },
                  shareMode === 'text' ? { backgroundColor: colors.primary + '20', borderColor: colors.primary } : { borderColor: colors.border }
                ]}
                onPress={() => setShareMode('text')}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={shareMode === 'text' ? colors.primary : colors.textMuted}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: shareMode === 'text' ? colors.primary : colors.textMuted }}>
                  {language === 'ko' ? '텍스트' : 'Text'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 6 },
                  shareMode === 'image' ? { backgroundColor: colors.primary + '20', borderColor: colors.primary } : { borderColor: colors.border }
                ]}
                onPress={() => setShareMode('image')}
              >
                <Ionicons
                  name="image-outline"
                  size={18}
                  color={shareMode === 'image' ? colors.primary : colors.textMuted}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: shareMode === 'image' ? colors.primary : colors.textMuted }}>
                  {language === 'ko' ? '이미지' : 'Image'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preview Content */}
            <ScrollView style={{ maxHeight: 384 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator>
              {shareMode === 'text' ? (
                <Text style={{ fontSize: 13, lineHeight: 22, color: colors.textPrimary, fontFamily: 'monospace' }}>
                  {previewMessage}
                </Text>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  {imageShareData.members.length > 0 ? (
                    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                        <Text style={{ fontSize: 20 }}>🎼</Text>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 }}>
                          {imageShareData.title}
                        </Text>
                      </View>
                      <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                        {/* Table Header */}
                        <View style={{ flexDirection: 'row', backgroundColor: colors.primary }}>
                          <View style={{ flex: 1, padding: 8, minWidth: 80 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFF' }}>{language === 'ko' ? '이름' : 'Name'}</Text>
                          </View>
                          {imageShareData.dates.slice(0, 4).map((date, i) => {
                            const d = parseLocalDate(date);
                            return (
                              <View key={i} style={{ width: 50, padding: 8, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFF' }}>{d.getMonth() + 1}/{d.getDate()}</Text>
                              </View>
                            );
                          })}
                        </View>
                        {/* Table Body */}
                        {imageShareData.members.slice(0, 5).map((member, i) => (
                          <View key={i} style={[{ flexDirection: 'row' }, i % 2 === 1 && { backgroundColor: colors.background }]}>
                            <View style={{ flex: 1, padding: 8, minWidth: 80, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 11 }}>{member.instrumentEmoji}</Text>
                              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                                {member.name}
                              </Text>
                            </View>
                            {imageShareData.dates.slice(0, 4).map((date, j) => (
                              <View key={j} style={{ width: 50, padding: 8, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: colors.border }}>
                                <Text style={{ color: member.dates.has(date) ? colors.success : colors.textMuted }}>
                                  {member.dates.has(date) ? '✓' : '·'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                      {(imageShareData.members.length > 5 || imageShareData.dates.length > 4) && (
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
                          {language === 'ko' ? '* 전체 일정이 이미지에 포함됩니다' : '* Full schedule will be included in image'}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>
                      {language === 'ko' ? '배정된 멤버가 없습니다' : 'No members assigned'}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={{ flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowPreview(false)}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary }}
                onPress={shareMode === 'text' ? confirmShare : confirmShareImage}
              >
                <Ionicons name={shareMode === 'text' ? 'share-outline' : 'image-outline'} size={18} color="#FFF" />
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFF' }}>
                  {language === 'ko' ? '공유하기' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hidden ShareTableImage for capture */}
      <ShareTableImage
        ref={shareTableRef}
        title={imageShareData.title}
        dates={imageShareData.dates}
        members={imageShareData.members}
      />
    </SafeAreaView>
  );
}
