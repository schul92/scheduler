/**
 * PraiseFlow Constants
 *
 * App-wide constants and labels
 */

// ============================================================================
// App Info
// ============================================================================

export const APP_NAME = '찬양팀';
export const APP_NAME_EN = 'PraiseFlow';
export const APP_VERSION = '1.0.0';

// ============================================================================
// Membership Roles
// ============================================================================

export const MEMBERSHIP_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type MembershipRoleType = typeof MEMBERSHIP_ROLES[keyof typeof MEMBERSHIP_ROLES];

// ============================================================================
// Service Statuses
// ============================================================================

export const SERVICE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ServiceStatusType = typeof SERVICE_STATUS[keyof typeof SERVICE_STATUS];

// ============================================================================
// Assignment Statuses
// ============================================================================

export const ASSIGNMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
} as const;

export type AssignmentStatusType = typeof ASSIGNMENT_STATUS[keyof typeof ASSIGNMENT_STATUS];

// ============================================================================
// Proficiency Levels
// ============================================================================

export const PROFICIENCY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
} as const;

// ============================================================================
// Default Team Colors
// ============================================================================

export const TEAM_COLORS = [
  '#D4A574', // Gold (default)
  '#795548', // Brown
  '#2196F3', // Blue
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#E91E63', // Pink
  '#00BCD4', // Teal
  '#9C27B0', // Purple
];

// ============================================================================
// Korean Labels
// ============================================================================

export const LABELS = {
  // Membership roles
  membershipRole: {
    owner: '소유자',
    admin: '관리자',
    member: '멤버',
  } as Record<string, string>,

  // Membership role badges (with icons)
  membershipRoleBadge: {
    owner: '👑 소유자',
    admin: '⭐ 관리자',
    member: '멤버',
  } as Record<string, string>,

  // Service statuses
  serviceStatus: {
    draft: '초안',
    published: '발행됨',
    completed: '완료',
    cancelled: '취소됨',
  } as Record<string, string>,

  // Assignment statuses
  assignmentStatus: {
    pending: '응답 대기',
    confirmed: '확정',
    declined: '불참',
  } as Record<string, string>,

  // Proficiency levels
  proficiencyLevel: {
    beginner: '초급',
    intermediate: '중급',
    advanced: '상급',
    expert: '전문가',
  } as Record<string, string>,

  // Days of week
  weekdays: {
    short: ['일', '월', '화', '수', '목', '금', '토'],
    long: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  },

  // Common actions
  actions: {
    save: '저장',
    cancel: '취소',
    delete: '삭제',
    edit: '수정',
    confirm: '확인',
    create: '만들기',
    add: '추가',
    remove: '제거',
    close: '닫기',
    back: '뒤로',
    next: '다음',
    done: '완료',
    submit: '제출',
    search: '검색',
    filter: '필터',
    refresh: '새로고침',
    retry: '다시 시도',
  },

  // Common states
  states: {
    loading: '로딩 중...',
    saving: '저장 중...',
    error: '오류가 발생했습니다',
    empty: '데이터가 없습니다',
    noResults: '검색 결과가 없습니다',
    success: '성공',
  },

  // Tab labels
  tabs: {
    home: '홈',
    schedule: '일정',
    myCalendar: '내 캘린더',
    profile: '프로필',
  },

  // Screen titles
  screens: {
    teamSettings: '팀 설정',
    members: '멤버 관리',
    services: '일정 목록',
    createService: '새 일정',
    serviceDetail: '일정 상세',
    availability: '가능 여부',
    notifications: '알림',
  },
};

// ============================================================================
// English Labels
// ============================================================================

export const LABELS_EN = {
  membershipRole: {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
  } as Record<string, string>,

  serviceStatus: {
    draft: 'Draft',
    published: 'Published',
    completed: 'Completed',
    cancelled: 'Cancelled',
  } as Record<string, string>,

  assignmentStatus: {
    pending: 'Pending',
    confirmed: 'Confirmed',
    declined: 'Declined',
  } as Record<string, string>,

  weekdays: {
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get label for a value based on language
 */
export function getLabel(
  category: keyof typeof LABELS,
  value: string,
  language: 'ko' | 'en' = 'ko'
): string {
  const labels = language === 'en' ? LABELS_EN : LABELS;
  const categoryLabels = labels[category as keyof typeof labels];

  if (typeof categoryLabels === 'object' && !Array.isArray(categoryLabels)) {
    return (categoryLabels as Record<string, string>)[value] || value;
  }

  return value;
}

/**
 * Get membership role label
 */
export function getMembershipRoleLabel(role: string, language: 'ko' | 'en' = 'ko'): string {
  return getLabel('membershipRole', role, language);
}

/**
 * Get service status label
 */
export function getServiceStatusLabel(status: string, language: 'ko' | 'en' = 'ko'): string {
  return getLabel('serviceStatus', status, language);
}

/**
 * Get assignment status label
 */
export function getAssignmentStatusLabel(status: string, language: 'ko' | 'en' = 'ko'): string {
  return getLabel('assignmentStatus', status, language);
}

// ============================================================================
// API/Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  ACTIVE_TEAM_ID: 'praiseflow_active_team_id',
  USER_LANGUAGE: 'praiseflow_user_language',
  ONBOARDING_COMPLETE: 'praiseflow_onboarding_complete',
  PUSH_TOKEN: 'praiseflow_push_token',
};

// ============================================================================
// Validation
// ============================================================================

export const VALIDATION = {
  teamName: {
    minLength: 2,
    maxLength: 50,
  },
  serviceName: {
    minLength: 2,
    maxLength: 100,
  },
  inviteCode: {
    length: 8,
  },
  phone: {
    minLength: 10,
    maxLength: 15,
  },
};
