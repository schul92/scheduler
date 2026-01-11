/**
 * Translations
 *
 * Korean and English translations for the app
 */

import { Language } from '../store/languageStore';

export const translations = {
  // Common
  common: {
    loading: { ko: '로딩 중...', en: 'Loading...' },
    save: { ko: '저장', en: 'Save' },
    cancel: { ko: '취소', en: 'Cancel' },
    confirm: { ko: '확인', en: 'Confirm' },
    delete: { ko: '삭제', en: 'Delete' },
    edit: { ko: '수정', en: 'Edit' },
    copy: { ko: '복사', en: 'Copy' },
    next: { ko: '다음', en: 'Next' },
    back: { ko: '뒤로', en: 'Back' },
    done: { ko: '완료', en: 'Done' },
    error: { ko: '오류', en: 'Error' },
    success: { ko: '성공', en: 'Success' },
  },

  // Tab Bar
  tabs: {
    home: { ko: '홈', en: 'Home' },
    members: { ko: '팀원', en: 'Members' },
    myCalendar: { ko: '내 캘린더', en: 'My Calendar' },
    profile: { ko: '프로필', en: 'Profile' },
    management: { ko: '관리', en: 'Settings' },
  },

  // Home Screen
  home: {
    welcomeBack: { ko: 'WELCOME BACK', en: 'WELCOME BACK' },
    hello: { ko: '안녕하세요', en: 'Hello' },
    greeting: { ko: '항상 기뻐하라', en: 'Rejoice always' },
    admin: { ko: '관리자', en: 'Admin' },
    leader: { ko: '리더', en: 'Leader' },
    myUpcoming: { ko: '나의 다가오는 일정', en: 'My Upcoming Schedule' },
    noSchedule: { ko: '예정된 일정이 없습니다', en: 'No upcoming schedule' },
    attentionNeeded: { ko: '주의 필요', en: 'Attention Needed' },
    membersPending: { ko: '명의 멤버가 이번 달 참석 가능 여부를 입력하지 않았습니다.', en: 'members have not submitted their availability this month.' },
    checkAndRemind: { ko: '확인하고 독려하기', en: 'Check and remind' },
    schedulingManagement: { ko: '스케줄링 관리', en: 'Scheduling Management' },
    seeAll: { ko: '전체 보기', en: 'See all' },
    step1Title: { ko: '찬양 날짜 설정하기', en: 'Set Worship Dates' },
    step1Desc: { ko: '팀원들이 참석 가능한 날짜를 달력에서 지정하세요.', en: 'Set dates for team members to submit availability.' },
    step2Title: { ko: '참석 가능 응답 현황 보기', en: 'View Availability Responses' },
    step2Desc: { ko: '팀원들의 참석 가능 응답 현황을 확인하세요.', en: 'Check team member availability responses.' },
    step3Title: { ko: '예배 스케줄 만들기', en: 'Create Service Schedule' },
    step3Desc: { ko: '팀원들의 참석 가능 정보를 바탕으로 예배 스케줄을 확정하세요.', en: 'Finalize service schedule based on availability.' },
    createService: { ko: '예배 만들기', en: 'Create Service' },
    inviteMembers: { ko: '멤버 초대', en: 'Invite Members' },
    manageAvailability: { ko: '내 참석 가능 여부 관리', en: 'Manage My Availability' },
    submitAvailability: { ko: '다음 달 스케줄 참석 가능 여부 입력을 완료해주세요.', en: 'Please complete your availability for next month.' },
    submit: { ko: '입력하기', en: 'Submit' },
    pendingResponse: { ko: '응답 대기', en: 'Pending Response' },
    respond: { ko: '응답하기', en: 'Respond' },
    upcomingSchedule: { ko: '다가오는 일정', en: 'Upcoming Schedule' },
  },

  // Members Screen
  members: {
    totalMembers: { ko: '총', en: 'Total' },
    membersCount: { ko: '명의 멤버', en: 'members' },
    invite: { ko: '초대', en: 'Invite' },
    owner: { ko: '관리자', en: 'Owner' },
    admin: { ko: '리더', en: 'Admin' },
    member: { ko: '멤버', en: 'Member' },
    noMembers: { ko: '아직 멤버가 없습니다', en: 'No members yet' },
    inviteHint: { ko: '초대 코드를 공유하여 멤버를 초대하세요', en: 'Share invite code to invite members' },
    inviteCode: { ko: '초대 코드', en: 'Invite Code' },
    shareInviteCode: { ko: '이 코드를 공유하여 멤버를 초대하세요', en: 'Share this code to invite members' },
  },

  // Calendar Screen
  calendar: {
    myCalendar: { ko: '내 캘린더', en: 'My Calendar' },
    export: { ko: '내보내기', en: 'Export' },
    noEvents: { ko: '일정이 없습니다', en: 'No events' },
    confirmed: { ko: '확정', en: 'Confirmed' },
    pending: { ko: '대기 중', en: 'Pending' },
    today: { ko: '오늘', en: 'Today' },
    events: { ko: '개 일정', en: 'events' },
  },

  // Profile Screen
  profile: {
    editProfile: { ko: '프로필 수정', en: 'Edit Profile' },
    myTeams: { ko: '내 팀', en: 'My Teams' },
    noTeams: { ko: '소속된 팀이 없습니다', en: 'No teams joined' },
    addTeam: { ko: '팀 추가하기', en: 'Add Team' },
    account: { ko: '계정', en: 'Account' },
    changePassword: { ko: '비밀번호 변경', en: 'Change Password' },
    deleteAccount: { ko: '계정 삭제', en: 'Delete Account' },
    signOut: { ko: '로그아웃', en: 'Sign Out' },
    signOutConfirm: { ko: '정말 로그아웃하시겠습니까?', en: 'Are you sure you want to sign out?' },
    noName: { ko: '이름 없음', en: 'No Name' },
  },

  // Management Screen
  management: {
    groupManagement: { ko: '내 그룹 선택/관리', en: 'My Groups' },
    currentGroup: { ko: '현재 선택된 그룹', en: 'Current Group' },
    selectGroup: { ko: '그룹 선택', en: 'Select Group' },
    groupSettings: { ko: '그룹 설정 (현재 그룹)', en: 'Group Settings (Current)' },
    createGroup: { ko: '+ 새 그룹 만들기', en: '+ Create New Group' },
    joinGroup: { ko: '그룹 참여하기', en: 'Join Group' },
    schedulingManagement: { ko: '스케줄링 관리', en: 'Scheduling Management' },
    step1: { ko: '1. 찬양 날짜 설정하기', en: '1. Set Worship Dates' },
    step1Desc: { ko: '팀원들이 참석 가능 여부를 제출할 날짜를 달력에서 지정하세요.', en: 'Set dates for members to submit availability.' },
    step2: { ko: '2. 응답 현황 보기', en: '2. View Availability Status' },
    step2Desc: { ko: '팀원들의 응답 현황을 확인하고 미응답 팀원에게 알림을 보냅니다.', en: 'Check availability responses and send reminders.' },
    step3: { ko: '3. 예배 스케줄 만들기', en: '3. Create Service Schedule' },
    step3Desc: { ko: '팀원들의 응답을 바탕으로 역할별 예배 스케줄을 확정합니다.', en: 'Finalize schedule based on availability.' },
    teamManagement: { ko: '팀원 관리', en: 'Team Management' },
    viewMembers: { ko: '팀원 목록 보기', en: 'View Members' },
    manageRoles: { ko: '역할 및 악기 관리', en: 'Manage Roles & Instruments' },
    sendInvite: { ko: '초대 코드/링크 보내기', en: 'Send Invite Code/Link' },
    appSettings: { ko: '앱 설정 및 정보', en: 'App Settings & Info' },
    darkMode: { ko: '다크 모드', en: 'Dark Mode' },
    notifications: { ko: '알림 설정', en: 'Notifications' },
    language: { ko: '언어 설정', en: 'Language' },
    help: { ko: '도움말 및 문의', en: 'Help & Support' },
    terms: { ko: '이용약관 및 개인정보 처리방침', en: 'Terms & Privacy Policy' },
    teamInviteCode: { ko: '팀 초대 코드', en: 'Team Invite Code' },
    shareToInvite: { ko: '이 코드를 공유하여 팀원을 초대하세요', en: 'Share this code to invite members' },
  },

  // Language names (for selector)
  languages: {
    korean: { ko: '한국어', en: 'Korean' },
    english: { ko: 'English', en: 'English' },
  },

  // Membership roles
  membershipRole: {
    owner: { ko: '관리자', en: 'Owner' },
    admin: { ko: '리더', en: 'Admin' },
    member: { ko: '멤버', en: 'Member' },
  },

  // Weekdays
  weekdays: {
    short: {
      ko: ['일', '월', '화', '수', '목', '금', '토'],
      en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    },
    long: {
      ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
      en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  },

  // Auth screens
  auth: {
    welcome: { ko: '환영합니다', en: 'Welcome' },
    signIn: { ko: '로그인', en: 'Sign In' },
    signUp: { ko: '회원가입', en: 'Sign Up' },
    email: { ko: '이메일', en: 'Email' },
    password: { ko: '비밀번호', en: 'Password' },
    confirmPassword: { ko: '비밀번호 확인', en: 'Confirm Password' },
    fullName: { ko: '이름', en: 'Full Name' },
    forgotPassword: { ko: '비밀번호를 잊으셨나요?', en: 'Forgot password?' },
    noAccount: { ko: '계정이 없으신가요?', en: "Don't have an account?" },
    hasAccount: { ko: '이미 계정이 있으신가요?', en: 'Already have an account?' },
    createTeam: { ko: '팀 만들기', en: 'Create Team' },
    joinTeam: { ko: '팀 참여하기', en: 'Join Team' },
    teamName: { ko: '팀 이름', en: 'Team Name' },
    inviteCode: { ko: '초대 코드', en: 'Invite Code' },
    enterInviteCode: { ko: '초대 코드를 입력하세요', en: 'Enter invite code' },
  },
} as const;

// Type for translation keys
type TranslationValue = { ko: string; en: string };
type TranslationSection = { [key: string]: TranslationValue | { [key: string]: string[] } };

// Helper function to get translation
export function t(
  section: keyof typeof translations,
  key: string,
  language: Language
): string {
  const sectionData = translations[section] as TranslationSection;
  const value = sectionData[key];

  if (!value) {
    console.warn(`Translation missing: ${section}.${key}`);
    return key;
  }

  if (typeof value === 'object' && 'ko' in value && 'en' in value) {
    return (value as TranslationValue)[language];
  }

  return key;
}

// Helper for array translations (like weekdays)
export function tArray(
  section: keyof typeof translations,
  key: string,
  subKey: string,
  language: Language
): string[] {
  const sectionData = translations[section] as any;
  const value = sectionData[key]?.[subKey];

  if (!value) {
    console.warn(`Translation missing: ${section}.${key}.${subKey}`);
    return [];
  }

  return value[language] || [];
}
