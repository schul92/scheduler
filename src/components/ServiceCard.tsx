/**
 * ServiceCard Component
 *
 * Reusable card for displaying worship service information
 * Shows date badge, service name, role assignment, and status
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useLanguage } from '../providers/LanguageProvider';
import { spacing, borderRadius, fontSize, shadows, lightColors } from '../lib/theme';

const staticColors = lightColors;

// Types
interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    service_date: string;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    status?: 'draft' | 'published' | 'completed' | 'cancelled';
  };
  myAssignment?: {
    role: {
      name: string;
      name_ko?: string | null;
    };
    status: 'pending' | 'confirmed' | 'declined';
  };
  assignmentCount?: number;
  confirmedCount?: number;
  onPress: () => void;
  showAssignmentStats?: boolean;
}

export function ServiceCard({
  service,
  myAssignment,
  assignmentCount,
  confirmedCount,
  onPress,
  showAssignmentStats = false,
}: ServiceCardProps) {
  const { colors } = useTheme();
  const { language } = useLanguage();

  // Format date for display
  const formatDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr);
    if (language === 'ko') {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return days[date.getDay()];
    }
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };

  const formatDayNumber = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.getDate().toString();
  };

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return null;
    return timeStr.slice(0, 5); // HH:MM
  };

  // Get status badge color and text
  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'draft':
        return { color: colors.warning, text: language === 'ko' ? '임시저장' : 'Draft' };
      case 'published':
        return { color: colors.success, text: language === 'ko' ? '게시됨' : 'Published' };
      case 'completed':
        return { color: colors.textMuted, text: language === 'ko' ? '완료' : 'Completed' };
      case 'cancelled':
        return { color: colors.error, text: language === 'ko' ? '취소됨' : 'Cancelled' };
      default:
        return null;
    }
  };

  // Get assignment status indicator
  const getAssignmentStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { icon: 'checkmark-circle', color: colors.success };
      case 'declined':
        return { icon: 'close-circle', color: colors.error };
      default:
        return { icon: 'time', color: colors.warning };
    }
  };

  const statusInfo = getStatusInfo(service.status);
  const assignmentStatus = myAssignment ? getAssignmentStatusIcon(myAssignment.status) : null;
  const isSunday = new Date(service.service_date).getDay() === 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left color bar */}
      <View style={[styles.colorBar, { backgroundColor: colors.primary }]} />

      {/* Content */}
      <View style={styles.content}>
        {/* Date Badge */}
        <View style={[styles.dateBadge, { backgroundColor: colors.background, borderColor: colors.primaryLight }]}>
          <Text style={[styles.dayOfWeek, { color: isSunday ? colors.error : colors.primary }]}>
            {formatDayOfWeek(service.service_date)}
          </Text>
          <Text style={[styles.dayNumber, { color: colors.textPrimary }]}>
            {formatDayNumber(service.service_date)}
          </Text>
        </View>

        {/* Service Info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {service.name}
          </Text>

          <View style={styles.metaRow}>
            {/* My Role Tag */}
            {myAssignment && (
              <View style={[styles.roleTag, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.roleTagText, { color: colors.primary }]}>
                  {language === 'ko' && myAssignment.role.name_ko
                    ? myAssignment.role.name_ko
                    : myAssignment.role.name}
                </Text>
                {assignmentStatus && (
                  <Ionicons
                    name={assignmentStatus.icon as any}
                    size={12}
                    color={assignmentStatus.color}
                    style={styles.roleStatusIcon}
                  />
                )}
              </View>
            )}

            {/* Assignment Stats */}
            {showAssignmentStats && assignmentCount !== undefined && (
              <View style={[styles.statsBadge, { backgroundColor: colors.textMuted + '15' }]}>
                <Ionicons name="people" size={12} color={colors.textSecondary} />
                <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                  {confirmedCount !== undefined ? `${confirmedCount}/${assignmentCount}` : assignmentCount}
                </Text>
              </View>
            )}

            {/* Time or Location */}
            {(service.start_time || service.location) && !myAssignment && (
              <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatTime(service.start_time) || service.location}
              </Text>
            )}

            {/* Status Badge */}
            {statusInfo && service.status !== 'published' && (
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '15' }]}>
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.text}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.xl,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  colorBar: {
    width: 4,
    backgroundColor: staticColors.primary,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  dateBadge: {
    width: 52,
    height: 52,
    backgroundColor: staticColors.background,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: staticColors.primaryLight,
  },
  dayOfWeek: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayNumber: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleStatusIcon: {
    marginLeft: 4,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statsText: {
    fontSize: 10,
    fontWeight: '600',
  },
  location: {
    fontSize: fontSize.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default ServiceCard;
