/**
 * Set Worship Dates Screen - Redesigned
 *
 * Leaders select dates to request team availability.
 * When a date has multiple services (like Sunday with 2부 & 4부),
 * shows a service selector to pick which services need availability.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeNavigation } from '../../../../hooks/useNavigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../../../providers/ThemeProvider';
import { useLanguage } from '../../../../providers/LanguageProvider';
import { useSchedulingStore } from '../../../../store/schedulingStore';
import { useAvailabilityStore } from '../../../../store/availabilityStore';
import { useServiceTypeStore } from '../../../../store/serviceTypeStore';
import { createService, getTeamServices, updateService, deleteService } from '../../../../lib/api/services';
import { spacing, borderRadius, fontSize, lightColors, shadows } from '../../../../lib/theme';

const staticColors = lightColors;

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to parse YYYY-MM-DD string as local date
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Convert HH:MM string to Date object
const timeToDate = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date;
};

// Convert Date to HH:MM string
const dateToTime = (date: Date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// Format time for display with AM/PM
const formatTimeDisplay = (time: string, lang: 'ko' | 'en') => {
  const [h, m] = time.split(':').map(Number);
  const isAM = h < 12;
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const period = lang === 'ko' ? (isAM ? '오전' : '오후') : (isAM ? 'AM' : 'PM');
  return `${period} ${hour}:${m.toString().padStart(2, '0')}`;
};

// Ad-hoc service type for special dates
interface AdhocService {
  id: string;
  serviceTime: string;
  practiceTime: string | null;
}

// Selection type: date + service combinations
type DateServiceSelection = {
  date: string;
  serviceTypeId: string;
};

export default function SetDatesScreen() {
  const router = useRouter();
  const { safeGoBack } = useSafeNavigation();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();

  // Start from next month if we're past the 15th
  const getInitialMonth = () => {
    const now = new Date();
    if (now.getDate() > 15) {
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const [currentMonth, setCurrentMonth] = useState(getInitialMonth);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Service selector modal state
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);

  // Ad-hoc service modal state
  const [adhocDateForModal, setAdhocDateForModal] = useState<string | null>(null);
  const [adhocServices, setAdhocServices] = useState<AdhocService[]>([
    { id: 'adhoc-1', serviceTime: '10:00', practiceTime: null }
  ]);
  const [editingAdhocServiceId, setEditingAdhocServiceId] = useState<string | null>(null);
  const [editingTimeType, setEditingTimeType] = useState<'service' | 'practice' | null>(null);

  // Store ad-hoc service details by date (date -> AdhocService[])
  const [adhocServiceDetails, setAdhocServiceDetails] = useState<Map<string, AdhocService[]>>(new Map());

  // Use scheduling store
  const {
    selectedDates: storedDates,
    setSelectedDates: setStoredDates,
    confirmDates,
    setPeriodTitle,
    isConfirmed: wasAlreadyConfirmed,
  } = useSchedulingStore();

  // Get service types
  const { getServiceTypes } = useServiceTypeStore();
  const serviceTypes = getServiceTypes(teamId || '');

  // Track date+service selections (e.g., "2026-01-11:service-1", "2026-01-11:service-2")
  const [selections, setSelections] = useState<Set<string>>(new Set());

  // Track existing services from Supabase (to handle deletions)
  const [existingServiceIds, setExistingServiceIds] = useState<Map<string, string>>(new Map()); // dateStr -> serviceId
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [hasLoadedFromSupabase, setHasLoadedFromSupabase] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load existing services from Supabase on mount
  useEffect(() => {
    const loadExistingServices = async () => {
      if (!teamId || hasLoadedFromSupabase) return;

      setIsLoadingServices(true);
      try {
        // Get first and last day of current month
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

        const services = await getTeamServices(teamId, {
          startDate: firstDay,
          endDate: lastDay,
          includePast: true, // Include past dates within the month
        });

        if (services.length > 0) {
          // Pre-select existing service dates
          // FIX: Match by service type name to handle multiple services per date
          const newSelections = new Set<string>();
          const serviceIdMap = new Map<string, string>();
          const loadedAdhocDetails = new Map<string, AdhocService[]>();

          // Ad-hoc service indicators (language-agnostic)
          const adhocIndicators = ['특별 일정', 'Special'];
          const ADHOC_PREFIX = 'adhoc';

          // Deduplicate services by date + service type name
          const seenServices = new Set<string>();
          const uniqueServices = services.filter(service => {
            const parts = service.name.split(' ');
            const serviceTypeName = parts.slice(1).join(' ') || service.name;
            const key = `${service.service_date}:${serviceTypeName}`;
            if (seenServices.has(key)) return false;
            seenServices.add(key);
            return true;
          });

          uniqueServices.forEach(service => {
            // Extract service type name from the service name (format: "M/D ServiceTypeName")
            const parts = service.name.split(' ');
            const serviceTypeName = parts.slice(1).join(' '); // Everything after the date

            // Check if this is an ad-hoc service (also check full name for robustness)
            const isAdhocService = adhocIndicators.some(indicator =>
              serviceTypeName.startsWith(indicator) || service.name.includes(indicator)
            );

            // Find matching service type by name
            const matchingType = serviceTypes.find(st => st.name === serviceTypeName);

            if (matchingType) {
              // Exact match with configured service type
              newSelections.add(`${service.service_date}:${matchingType.id}`);
              serviceIdMap.set(`${service.service_date}:${matchingType.id}`, service.id);
            } else if (isAdhocService) {
              // Handle ad-hoc service (특별 일정 / Special)
              const existingAdhocs = loadedAdhocDetails.get(service.service_date) || [];
              const adhocIndex = existingAdhocs.length;

              // Extract time from start_time or service name
              const serviceTime = service.start_time || '10:00';

              existingAdhocs.push({
                id: `adhoc-loaded-${adhocIndex}`,
                serviceTime: serviceTime,
                practiceTime: null, // Practice time not stored in DB currently
              });
              loadedAdhocDetails.set(service.service_date, existingAdhocs);

              const selectionKey = `${service.service_date}:${ADHOC_PREFIX}-${adhocIndex}`;
              newSelections.add(selectionKey);
              serviceIdMap.set(selectionKey, service.id);
            } else {
              // No match - check if this date has no pre-configured service types
              // If so, treat as ad-hoc; otherwise use day-of-week fallback
              const dayOfWeek = new Date(service.service_date + 'T00:00:00').getDay();
              const hasConfiguredType = serviceTypes.some(st => st.defaultDay === dayOfWeek);

              if (!hasConfiguredType) {
                // No configured service type for this day - treat as ad-hoc
                const existingAdhocs = loadedAdhocDetails.get(service.service_date) || [];
                const adhocIndex = existingAdhocs.length;
                const serviceTime = service.start_time || '10:00';

                existingAdhocs.push({
                  id: `adhoc-loaded-${adhocIndex}`,
                  serviceTime: serviceTime,
                  practiceTime: null,
                });
                loadedAdhocDetails.set(service.service_date, existingAdhocs);

                const selectionKey = `${service.service_date}:${ADHOC_PREFIX}-${adhocIndex}`;
                newSelections.add(selectionKey);
                serviceIdMap.set(selectionKey, service.id);
              } else {
                // Has configured type - use day-of-week fallback for legacy services
                const fallbackType = serviceTypes.find(st => st.defaultDay === dayOfWeek);
                const serviceTypeId = fallbackType?.id || serviceTypes[0]?.id || 'default';
                newSelections.add(`${service.service_date}:${serviceTypeId}`);
                serviceIdMap.set(`${service.service_date}:${serviceTypeId}`, service.id);
              }
            }
          });

          setSelections(newSelections);
          setExistingServiceIds(serviceIdMap);

          // Restore ad-hoc service details
          if (loadedAdhocDetails.size > 0) {
            setAdhocServiceDetails(loadedAdhocDetails);
          }

          // Update local store
          const uniqueDates = [...new Set(services.map(s => s.service_date))];
          setStoredDates(uniqueDates);
        } else if (serviceTypes.length > 0) {
          // No existing services - auto-select based on service types
          const autoSelections = generateAutoSelectionsForMonth();
          if (autoSelections.length > 0) {
            setSelections(new Set(autoSelections));
            const uniqueDates = [...new Set(autoSelections.map(s => s.split(':')[0]))];
            setStoredDates(uniqueDates);
          }
        }
      } catch (error) {
        console.error('[SetDates] Failed to load existing services:', error);
        // Fall back to auto-select
        if (serviceTypes.length > 0) {
          const autoSelections = generateAutoSelectionsForMonth();
          if (autoSelections.length > 0) {
            setSelections(new Set(autoSelections));
          }
        }
      } finally {
        setIsLoadingServices(false);
        setHasLoadedFromSupabase(true);
      }
    };

    loadExistingServices();
  }, [teamId, currentMonth, serviceTypes, hasLoadedFromSupabase]);

  // Helper function for auto-selection
  const generateAutoSelectionsForMonth = () => {
    const newSelections: string[] = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      if (date < today) continue;

      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];

      serviceTypes.forEach(st => {
        if (st.defaultDay === dayOfWeek) {
          newSelections.push(`${dateStr}:${st.id}`);
        }
      });
    }
    return newSelections;
  };

  const WEEKDAYS = language === 'ko' ? WEEKDAYS_KO : WEEKDAYS_EN;

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: string; day: number; isCurrentMonth: boolean; isPast: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 1, day);
      days.push({
        date: date.toISOString().split('T')[0],
        day,
        isCurrentMonth: false,
        isPast: date < today,
      });
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      days.push({
        date: date.toISOString().split('T')[0],
        day,
        isCurrentMonth: true,
        isPast: date < today,
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date: date.toISOString().split('T')[0],
        day,
        isCurrentMonth: false,
        isPast: false,
      });
    }

    return days;
  }, [currentMonth]);

  const today = new Date().toISOString().split('T')[0];

  // Get services available on a specific day of week
  const getServicesForDay = useCallback((dayOfWeek: number) => {
    return serviceTypes.filter(st => st.defaultDay === dayOfWeek);
  }, [serviceTypes]);

  // Get services for a specific date
  const getServicesForDate = useCallback((dateStr: string) => {
    const dayOfWeek = parseLocalDate(dateStr).getDay();
    return getServicesForDay(dayOfWeek);
  }, [getServicesForDay]);

  // Check if a date has any selection
  const hasAnySelection = useCallback((dateStr: string) => {
    return Array.from(selections).some(s => s.startsWith(`${dateStr}:`));
  }, [selections]);

  // Check if a specific service is selected for a date
  const isServiceSelected = useCallback((dateStr: string, serviceId: string) => {
    return selections.has(`${dateStr}:${serviceId}`);
  }, [selections]);

  // Get selected services for a date
  const getSelectedServicesForDate = useCallback((dateStr: string) => {
    return Array.from(selections)
      .filter(s => s.startsWith(`${dateStr}:`))
      .map(s => s.split(':')[1]);
  }, [selections]);

  // Special ID prefix for ad-hoc services (dates without pre-configured service types)
  const ADHOC_SERVICE_PREFIX = 'adhoc';

  // Handle date tap
  const handleDateTap = useCallback((dateStr: string) => {
    const availableServices = getServicesForDate(dateStr);

    if (availableServices.length === 0) {
      // No pre-configured services for this day - show ad-hoc configuration modal
      // Check if we already have ad-hoc services for this date
      const existingAdhocServices = adhocServiceDetails.get(dateStr);
      if (existingAdhocServices && existingAdhocServices.length > 0) {
        // Load existing ad-hoc services for editing
        setAdhocServices(existingAdhocServices);
      } else {
        // Start with one service
        setAdhocServices([{ id: 'adhoc-1', serviceTime: '10:00', practiceTime: null }]);
      }
      setAdhocDateForModal(dateStr);
      return;
    }

    if (availableServices.length === 1) {
      // Only one service - toggle it directly
      const serviceId = availableServices[0].id;
      const key = `${dateStr}:${serviceId}`;
      const newSelections = new Set(selections);

      if (newSelections.has(key)) {
        newSelections.delete(key);
      } else {
        newSelections.add(key);
      }

      setSelections(newSelections);
      updateStoreDates(newSelections);
    } else {
      // Multiple services - show modal
      setSelectedDateForModal(dateStr);
    }
  }, [getServicesForDate, selections, adhocServiceDetails]);

  // Update store with unique dates (must be before functions that use it)
  const updateStoreDates = useCallback((selectionSet: Set<string>) => {
    const uniqueDates = [...new Set(Array.from(selectionSet).map(s => s.split(':')[0]))];
    setStoredDates(uniqueDates);
  }, [setStoredDates]);

  // Ad-hoc modal actions
  const addAdhocService = useCallback(() => {
    // Use timestamp for unique ID to prevent collisions
    const newId = `adhoc-${Date.now()}`;
    // Reset any open time picker when adding new service
    setEditingAdhocServiceId(null);
    setEditingTimeType(null);
    setAdhocServices([...adhocServices, { id: newId, serviceTime: '10:00', practiceTime: null }]);
  }, [adhocServices]);

  const removeAdhocService = useCallback((serviceId: string) => {
    const remaining = adhocServices.filter(s => s.id !== serviceId);
    if (remaining.length === 0) {
      // Last service removed - close modal and deselect the date
      if (adhocDateForModal) {
        // Remove all selections for this date (including any stale regular selections)
        const newSelections = new Set(
          Array.from(selections).filter(s => !s.startsWith(`${adhocDateForModal}:`))
        );
        setSelections(newSelections);
        const newDetails = new Map(adhocServiceDetails);
        newDetails.delete(adhocDateForModal);
        setAdhocServiceDetails(newDetails);
        updateStoreDates(newSelections);
      }
      setAdhocDateForModal(null);
      setAdhocServices([{ id: `adhoc-${Date.now()}`, serviceTime: '10:00', practiceTime: null }]);
    } else {
      setAdhocServices(remaining);
    }
    // Reset editing state
    setEditingAdhocServiceId(null);
    setEditingTimeType(null);
  }, [adhocServices, adhocDateForModal, selections, adhocServiceDetails, updateStoreDates]);

  const updateAdhocServiceTime = useCallback((serviceId: string, time: string) => {
    setAdhocServices(adhocServices.map(s =>
      s.id === serviceId ? { ...s, serviceTime: time } : s
    ));
  }, [adhocServices]);

  const updateAdhocPracticeTime = useCallback((serviceId: string, time: string | null) => {
    setAdhocServices(adhocServices.map(s =>
      s.id === serviceId ? { ...s, practiceTime: time } : s
    ));
  }, [adhocServices]);

  // Toggle service selection in modal
  const toggleServiceForDate = useCallback((dateStr: string, serviceId: string) => {
    const key = `${dateStr}:${serviceId}`;
    const newSelections = new Set(selections);

    if (newSelections.has(key)) {
      newSelections.delete(key);
    } else {
      newSelections.add(key);
    }

    setSelections(newSelections);
    updateStoreDates(newSelections);
  }, [selections, updateStoreDates]);

  // Ad-hoc confirmation handlers
  const confirmAdhocServices = useCallback(() => {
    if (!adhocDateForModal) return;

    const newSelections = new Set(selections);
    const dateStr = adhocDateForModal;

    // Remove ALL selections for this date (not just ad-hoc)
    // Since ad-hoc modal only opens for dates without configured services,
    // any other selection is stale and should be removed
    Array.from(newSelections).forEach(s => {
      if (s.startsWith(`${dateStr}:`)) {
        newSelections.delete(s);
      }
    });

    // Add new selections for each ad-hoc service
    adhocServices.forEach((service, index) => {
      newSelections.add(`${dateStr}:${ADHOC_SERVICE_PREFIX}-${index}`);
    });

    // Save ad-hoc service details
    const newDetails = new Map(adhocServiceDetails);
    newDetails.set(dateStr, [...adhocServices]);
    setAdhocServiceDetails(newDetails);

    setSelections(newSelections);
    updateStoreDates(newSelections);
    setAdhocDateForModal(null);
  }, [adhocDateForModal, adhocServices, selections, adhocServiceDetails, updateStoreDates]);

  const removeAdhocDate = useCallback(() => {
    if (!adhocDateForModal) return;

    const dateStr = adhocDateForModal;
    const newSelections = new Set(selections);

    // Remove all selections for this date
    Array.from(newSelections).forEach(s => {
      if (s.startsWith(`${dateStr}:`)) {
        newSelections.delete(s);
      }
    });

    // Remove ad-hoc service details
    const newDetails = new Map(adhocServiceDetails);
    newDetails.delete(dateStr);
    setAdhocServiceDetails(newDetails);

    setSelections(newSelections);
    updateStoreDates(newSelections);
    setAdhocDateForModal(null);
  }, [adhocDateForModal, selections, adhocServiceDetails, updateStoreDates]);

  // Navigation
  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Format month header
  const formatMonthYear = () => {
    if (language === 'ko') {
      return currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    }
    return currentMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Calculate stats
  const totalSelections = selections.size;
  const uniqueDatesCount = new Set(Array.from(selections).map(s => s.split(':')[0])).size;

  // Group selections by service type for display
  const getSelectionsByServiceType = useCallback(() => {
    const result: { serviceType: typeof serviceTypes[0] | null; count: number; dates: string[]; isAdhoc?: boolean }[] = [];

    // First, handle regular service types
    serviceTypes.forEach(st => {
      const matchingSelections = Array.from(selections)
        .filter(s => s.endsWith(`:${st.id}`))
        .map(s => s.split(':')[0])
        .sort();

      if (matchingSelections.length > 0) {
        result.push({ serviceType: st, count: matchingSelections.length, dates: matchingSelections });
      }
    });

    // Then, handle ad-hoc selections (count total ad-hoc services, not just dates)
    const adhocSelections = Array.from(selections)
      .filter(s => s.includes(`:${ADHOC_SERVICE_PREFIX}`))
      .map(s => s.split(':')[0]);

    // Get unique dates for ad-hoc
    const uniqueAdhocDates = [...new Set(adhocSelections)].sort();

    if (uniqueAdhocDates.length > 0) {
      // Count total ad-hoc services across all dates
      const totalAdhocCount = adhocSelections.length;
      result.push({
        serviceType: null,
        count: totalAdhocCount,
        dates: uniqueAdhocDates,
        isAdhoc: true
      });
    }

    return result;
  }, [selections, serviceTypes]);

  // Quick actions
  const selectAllForMonth = () => {
    const newSelections = new Set(selections);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      if (date < todayDate) continue;

      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      serviceTypes.forEach(st => {
        if (st.defaultDay === dayOfWeek) {
          newSelections.add(`${dateStr}:${st.id}`);
        }
      });
    }

    setSelections(newSelections);
    updateStoreDates(newSelections);
  };

  const clearAll = () => {
    setSelections(new Set());
    setStoredDates([]);
  };

  // Get availability store sync function
  const { syncDatesFromLeader } = useAvailabilityStore();

  const handleComplete = () => {
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (isSending) return; // Prevent double-click
    setIsSending(true);

    const sortedDates = [...new Set(Array.from(selections).map(s => s.split(':')[0]))].sort();
    const selectedDatesSet = new Set(sortedDates);

    if (sortedDates.length > 0) {
      const firstDate = parseLocalDate(sortedDates[0]);
      const title = language === 'ko'
        ? `${firstDate.getFullYear()}년 ${firstDate.getMonth() + 1}월 찬양`
        : `${firstDate.toLocaleString('en-US', { month: 'long' })} ${firstDate.getFullYear()} Worship`;
      setPeriodTitle(title);
    }

    confirmDates();

    // Save services to Supabase for each date+serviceType
    // This allows team members to see requested dates
    // FIX: Use composite key (date:serviceTypeName) to handle multiple services per date
    if (teamId) {
      try {
        // Get the month range for the current view
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

        // First, get ALL existing services for the month (to handle deletions)
        const existingServices = await getTeamServices(teamId, {
          startDate: firstDay,
          endDate: lastDay,
          includePast: true,
        });

        // Map of existing services by composite key (date:serviceTypeName) for quick lookup
        // This handles multiple services on the same date correctly
        const existingByKey = new Map<string, typeof existingServices[0]>();
        existingServices.forEach(s => {
          // Extract service type name from the service name (format: "M/D ServiceTypeName")
          const parts = s.name.split(' ');
          const serviceTypeName = parts.slice(1).join(' '); // Everything after the date
          const key = `${s.service_date}:${serviceTypeName}`;
          existingByKey.set(key, s);
        });

        // Build set of selected composite keys
        const selectedKeys = new Set<string>();
        const adhocBaseServiceName = language === 'ko' ? '특별 일정' : 'Special';

        for (const selection of Array.from(selections)) {
          const [dateStr, serviceTypeId] = selection.split(':');
          if (serviceTypeId.startsWith(ADHOC_SERVICE_PREFIX)) {
            // For ad-hoc, extract the index from the serviceTypeId (e.g., "adhoc-0" -> 0)
            const adhocIndex = parseInt(serviceTypeId.split('-')[1] || '0', 10);
            const adhocDetails = adhocServiceDetails.get(dateStr);
            const adhocService = adhocDetails?.[adhocIndex];
            const adhocName = adhocService
              ? `${adhocBaseServiceName} ${formatTimeDisplay(adhocService.serviceTime, language)}`
              : adhocBaseServiceName;
            selectedKeys.add(`${dateStr}:${adhocName}`);
          } else {
            const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
            if (serviceType) {
              selectedKeys.add(`${dateStr}:${serviceType.name}`);
            }
          }
        }

        // Delete services that were deselected
        for (const [key, service] of existingByKey) {
          if (!selectedKeys.has(key)) {
            try {
              await deleteService(service.id);
              console.log('[SetDates] Deleted deselected service:', key);
            } catch (deleteError) {
              console.error('[SetDates] Failed to delete service:', deleteError);
            }
          }
        }

        // Create or update services for selected dates
        for (const selection of Array.from(selections)) {
          const [dateStr, serviceTypeId] = selection.split(':');
          const date = parseLocalDate(dateStr);

          // Handle ad-hoc services
          if (serviceTypeId.startsWith(ADHOC_SERVICE_PREFIX)) {
            // Extract ad-hoc index and get service details
            const adhocIndex = parseInt(serviceTypeId.split('-')[1] || '0', 10);
            const adhocDetails = adhocServiceDetails.get(dateStr);
            const adhocService = adhocDetails?.[adhocIndex];
            const serviceTime = adhocService?.serviceTime || '10:00';
            const practiceTime = adhocService?.practiceTime;

            const adhocName = `${adhocBaseServiceName} ${formatTimeDisplay(serviceTime, language)}`;
            const key = `${dateStr}:${adhocName}`;
            const existingService = existingByKey.get(key);

            if (existingService) {
              if (existingService.status === 'draft') {
                await updateService(existingService.id, { status: 'published' });
                console.log('[SetDates] Published existing ad-hoc service:', key);
              }
              continue;
            }

            // Create new ad-hoc service
            const serviceName = language === 'ko'
              ? `${date.getMonth() + 1}/${date.getDate()} ${adhocName}`
              : `${date.getMonth() + 1}/${date.getDate()} ${adhocName}`;

            await createService({
              team_id: teamId,
              name: serviceName,
              service_date: dateStr,
              start_time: serviceTime,
              status: 'published',
              // Note: Practice time could be stored in service notes or a separate field if needed
            });

            console.log('[SetDates] Created ad-hoc service:', key, practiceTime ? `(practice: ${practiceTime})` : '');
            continue;
          }

          // Handle regular services
          const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
          if (!serviceType) continue;

          const key = `${dateStr}:${serviceType.name}`;
          const existingService = existingByKey.get(key);

          if (existingService) {
            // Update existing service to published if it's draft
            if (existingService.status === 'draft') {
              await updateService(existingService.id, { status: 'published' });
              console.log('[SetDates] Published existing draft service:', key);
            } else {
              console.log('[SetDates] Service already published:', key);
            }
            continue;
          }

          // Create new service
          const serviceName = language === 'ko'
            ? `${date.getMonth() + 1}/${date.getDate()} ${serviceType.name}`
            : `${date.getMonth() + 1}/${date.getDate()} ${serviceType.name}`;

          await createService({
            team_id: teamId,
            name: serviceName,
            service_date: dateStr,
            start_time: serviceType.serviceTime || '10:00',
            status: 'published', // Published so it appears in calendar
          });

          console.log('[SetDates] Created service:', key);
        }
      } catch (error) {
        console.error('[SetDates] Failed to save services to Supabase:', error);
        // Continue anyway - local flow still works
      }
    }

    // Sync with local availability store
    const syncResult = syncDatesFromLeader(
      sortedDates,
      serviceTypes,
      teamId || 'team-1',
      null
    );

    console.log('Dates sync result:', syncResult);

    setIsConfirmed(true);
    setIsSending(false);

    setTimeout(() => {
      setShowConfirmModal(false);
      safeGoBack();
    }, 1500);
  };

  // Modal date info - only shows for dates with pre-configured services
  // Ad-hoc dates toggle directly without showing modal
  const modalDateServices = selectedDateForModal ? getServicesForDate(selectedDateForModal) : [];
  const modalDate = selectedDateForModal ? parseLocalDate(selectedDateForModal) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {language === 'ko' ? '출석 요청 날짜 설정' : 'Set Availability Dates'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Already Notified Indicator */}
        {existingServiceIds.size > 0 && !isLoadingServices && (
          <View style={[styles.notifiedBanner, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}>
            <View style={[styles.notifiedIconCircle, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            </View>
            <View style={styles.notifiedTextContainer}>
              <Text style={[styles.notifiedTitle, { color: colors.success }]}>
                {language === 'ko' ? '이번 달 알림 발송 완료' : 'Notification sent this month'}
              </Text>
              <Text style={[styles.notifiedSubtext, { color: colors.textSecondary }]}>
                {language === 'ko'
                  ? `${existingServiceIds.size}개 예배일이 설정됨 · 수정 가능`
                  : `${existingServiceIds.size} service dates set · Editable`}
              </Text>
            </View>
          </View>
        )}

        {/* Purpose Description */}
        <View style={[styles.purposeCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.purposeText, { color: colors.primary }]}>
            {language === 'ko'
              ? '팀원들에게 출석 여부를 요청할 날짜를 선택하세요.\n여러 예배가 있는 날은 탭하여 선택할 수 있습니다.'
              : 'Select dates to request availability from team members.\nTap dates with multiple services to choose which ones.'}
          </Text>
        </View>

        {/* Calendar Card */}
        <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Month Navigation */}
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.monthButton}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
              {formatMonthYear()}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.monthButton}>
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekday Headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day, index) => (
              <View key={day} style={styles.weekdayCell}>
                <Text
                  style={[
                    styles.weekdayText,
                    { color: colors.textMuted },
                    index === 0 && { color: colors.error },
                    index === 6 && { color: colors.info },
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          {isLoadingServices ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {language === 'ko' ? '기존 일정 불러오는 중...' : 'Loading existing dates...'}
              </Text>
            </View>
          ) : (
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const dayOfWeek = index % 7;
              const services = getServicesForDate(day.date);
              const hasServices = services.length > 0;
              const isSelected = hasAnySelection(day.date);
              const selectedCount = getSelectedServicesForDate(day.date).length;
              // Show badge if multiple selections OR multiple pre-configured services
              const showBadge = selectedCount > 1 || (isSelected && services.length > 1);
              const isToday = day.date === today;
              const isDisabled = day.isPast || !day.isCurrentMonth;

              return (
                <TouchableOpacity
                  key={`${day.date}-${index}`}
                  style={styles.dayCell}
                  onPress={() => !isDisabled && handleDateTap(day.date)}
                  disabled={isDisabled}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.dayInner,
                      hasServices && !isDisabled && { backgroundColor: colors.primary + '08' },
                      isSelected && [styles.daySelected, { backgroundColor: colors.primary }],
                      isToday && !isSelected && [styles.dayToday, { borderColor: colors.primary }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: colors.textPrimary },
                        isDisabled && { color: colors.textMuted, opacity: 0.3 },
                        dayOfWeek === 0 && !isDisabled && { color: colors.error },
                        dayOfWeek === 6 && !isDisabled && { color: colors.info },
                        isSelected && { color: '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {day.day}
                    </Text>

                    {/* Service indicator dots */}
                    {hasServices && !isDisabled && !isSelected && (
                      <View style={styles.serviceDots}>
                        {services.map((s, i) => (
                          <View
                            key={s.id}
                            style={[
                              styles.serviceDot,
                              { backgroundColor: isServiceSelected(day.date, s.id) ? colors.primary : colors.textMuted + '40' },
                            ]}
                          />
                        ))}
                      </View>
                    )}

                    {/* Selection count badge for multiple services */}
                    {isSelected && showBadge && (
                      <View style={[styles.selectionBadge, { backgroundColor: '#FFFFFF' }]}>
                        <Text style={[styles.selectionBadgeText, { color: colors.primary }]}>
                          {selectedCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isToday && !isSelected && (
                    <Text style={[styles.todayLabel, { color: colors.primary }]}>
                      {language === 'ko' ? '오늘' : 'Today'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          )}

          {/* Legend */}
          <View style={[styles.legend, { borderTopColor: colors.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                {language === 'ko' ? '선택됨' : 'Selected'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDotsExample}>
                <View style={[styles.serviceDot, { backgroundColor: colors.textMuted + '40' }]} />
                <View style={[styles.serviceDot, { backgroundColor: colors.textMuted + '40' }]} />
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                {language === 'ko' ? '여러 예배' : 'Multiple services'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={selectAllForMonth}
          >
            <Ionicons name="checkbox-outline" size={18} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>
              {language === 'ko' ? '이번 달 모두 선택' : 'Select All This Month'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={clearAll}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.quickActionText, { color: colors.textSecondary }]}>
              {language === 'ko' ? '모두 해제' : 'Clear All'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selection Summary */}
        {totalSelections > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.summaryHeader}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
                {language === 'ko'
                  ? `${totalSelections}개 예배 선택됨`
                  : `${totalSelections} services selected`}
              </Text>
            </View>
            <View style={styles.summaryBreakdown}>
              {getSelectionsByServiceType().map(({ serviceType, count, isAdhoc }) => (
                <View key={isAdhoc ? 'adhoc' : serviceType?.id} style={[styles.summaryItem, { backgroundColor: isAdhoc ? colors.warning + '10' : colors.primary + '10' }]}>
                  <Text style={[styles.summaryItemName, { color: isAdhoc ? colors.warning : colors.primary }]}>
                    {isAdhoc ? (language === 'ko' ? '특별 일정' : 'Special') : serviceType?.name}
                  </Text>
                  <Text style={[styles.summaryItemCount, { color: isAdhoc ? colors.warning : colors.primary }]}>
                    {count}{language === 'ko' ? '회' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            { backgroundColor: colors.primary },
            totalSelections === 0 && { opacity: 0.5 },
          ]}
          onPress={handleComplete}
          disabled={totalSelections === 0}
        >
          <Text style={styles.confirmButtonText}>
            {existingServiceIds.size > 0
              ? (language === 'ko' ? '수정하기' : 'Save Changes')
              : (language === 'ko' ? '출석 요청 보내기' : 'Send Availability Request')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Service Selector Modal */}
      <Modal
        visible={!!selectedDateForModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDateForModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDateForModal(null)}
        >
          <View
            style={[styles.serviceModalContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Modal Header */}
            <View style={styles.serviceModalHeader}>
              <Text style={[styles.serviceModalDate, { color: colors.textPrimary }]}>
                {modalDate && (language === 'ko'
                  ? modalDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
                  : modalDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' }))}
              </Text>
              <Text style={[styles.serviceModalSubtitle, { color: colors.textSecondary }]}>
                {language === 'ko' ? '출석 요청할 예배를 선택하세요' : 'Select services to request availability'}
              </Text>
            </View>

            {/* Service Options */}
            <View style={styles.serviceOptions}>
              {modalDateServices.map((service) => {
                const isSelected = selectedDateForModal && isServiceSelected(selectedDateForModal, service.id);
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceOption,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      isSelected && { backgroundColor: colors.primary + '15', borderColor: colors.primary },
                    ]}
                    onPress={() => selectedDateForModal && toggleServiceForDate(selectedDateForModal, service.id)}
                  >
                    <View style={styles.serviceOptionInfo}>
                      <Text style={[styles.serviceOptionName, { color: colors.textPrimary }]}>
                        {service.name}
                      </Text>
                      {service.serviceTime && (
                        <Text style={[styles.serviceOptionTime, { color: colors.textSecondary }]}>
                          {service.serviceTime}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.serviceOptionCheck,
                        { borderColor: colors.border },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={[styles.serviceModalDone, { backgroundColor: colors.primary }]}
              onPress={() => setSelectedDateForModal(null)}
            >
              <Text style={styles.serviceModalDoneText}>
                {language === 'ko' ? '완료' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Ad-hoc Service Configuration Modal */}
      <Modal
        visible={!!adhocDateForModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAdhocDateForModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAdhocDateForModal(null)}
        >
          <View
            style={[styles.adhocModalContent, { backgroundColor: colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Modal Header */}
            <View style={styles.serviceModalHeader}>
              <Text style={[styles.serviceModalDate, { color: colors.textPrimary }]}>
                {adhocDateForModal && (() => {
                  const date = parseLocalDate(adhocDateForModal);
                  return language === 'ko'
                    ? date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
                    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' });
                })()}
              </Text>
              <Text style={[styles.serviceModalSubtitle, { color: colors.textSecondary }]}>
                {language === 'ko' ? '예배 시간을 설정하세요' : 'Set service times for this date'}
              </Text>
            </View>

            {/* Service List - scrollable when more than 2-3 services */}
            <ScrollView
              style={styles.adhocServiceList}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {adhocServices.map((service, index) => (
                <View key={service.id} style={[styles.adhocServiceItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.adhocServiceHeader}>
                    <View style={[styles.adhocServiceNumber, { backgroundColor: colors.warning + '20' }]}>
                      <Text style={[styles.adhocServiceNumberText, { color: colors.warning }]}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={[styles.adhocServiceTitle, { color: colors.textPrimary }]}>
                      {language === 'ko' ? `예배 ${index + 1}` : `Service ${index + 1}`}
                    </Text>
                    {/* Always show delete button - removing last service will close modal */}
                    <TouchableOpacity
                      style={[styles.adhocRemoveBtn, { backgroundColor: colors.error + '15' }]}
                      onPress={() => removeAdhocService(service.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  {/* Service Time - inline picker */}
                  <View style={[styles.adhocTimeRow, { borderColor: colors.border }]}>
                    <View style={styles.adhocTimeLabel}>
                      <Ionicons name="time-outline" size={18} color={colors.primary} />
                      <Text style={[styles.adhocTimeLabelText, { color: colors.textPrimary }]}>
                        {language === 'ko' ? '예배 시간' : 'Service Time'}
                      </Text>
                    </View>
                    <DateTimePicker
                      key={`service-time-${service.id}`}
                      value={timeToDate(service.serviceTime)}
                      mode="time"
                      display="default"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          updateAdhocServiceTime(service.id, dateToTime(selectedDate));
                        }
                      }}
                      themeVariant="dark"
                      accentColor={colors.primary}
                      style={{ minWidth: 100 }}
                    />
                  </View>

                  {/* Practice Time (Optional) - inline */}
                  <View style={[styles.adhocTimeRow, { borderColor: colors.border }]}>
                    <View style={styles.adhocTimeLabel}>
                      <Ionicons name="musical-notes-outline" size={18} color={colors.info} />
                      <Text style={[styles.adhocTimeLabelText, { color: colors.textPrimary }]}>
                        {language === 'ko' ? '연습 시간' : 'Practice'}
                      </Text>
                      <Text style={[styles.adhocTimeOptional, { color: colors.textMuted }]}>
                        {language === 'ko' ? '(선택)' : '(opt.)'}
                      </Text>
                    </View>
                    {service.practiceTime ? (
                      <View style={styles.adhocPracticeValue}>
                        <DateTimePicker
                          key={`practice-time-${service.id}`}
                          value={timeToDate(service.practiceTime)}
                          mode="time"
                          display="default"
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              updateAdhocPracticeTime(service.id, dateToTime(selectedDate));
                            }
                          }}
                          themeVariant="dark"
                          accentColor={colors.info}
                          style={{ minWidth: 90 }}
                        />
                        <TouchableOpacity
                          onPress={() => updateAdhocPracticeTime(service.id, null)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={{ marginLeft: 4 }}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.adhocAddPracticeBtn}
                        onPress={() => {
                          const [h, m] = service.serviceTime.split(':').map(Number);
                          const practiceHour = h > 0 ? h - 1 : 23;
                          updateAdhocPracticeTime(service.id, `${practiceHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                        }}
                      >
                        <Text style={[styles.adhocAddPracticeBtnText, { color: colors.textMuted }]}>
                          {language === 'ko' ? '추가' : 'Add'}
                        </Text>
                        <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              {/* Add Another Service Button */}
              <TouchableOpacity
                style={[styles.adhocAddBtn, { borderColor: colors.border }]}
                onPress={addAdhocService}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.adhocAddBtnText, { color: colors.primary }]}>
                  {language === 'ko' ? '예배 추가' : 'Add Another Service'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.adhocModalActions}>
              <TouchableOpacity
                style={[styles.adhocCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  // Close without saving - reset to original state
                  setAdhocDateForModal(null);
                  setAdhocServices([{ id: `adhoc-${Date.now()}`, serviceTime: '10:00', practiceTime: null }]);
                  setEditingAdhocServiceId(null);
                  setEditingTimeType(null);
                }}
              >
                <Text style={[styles.adhocCancelBtnText, { color: colors.textSecondary }]}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adhocConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={confirmAdhocServices}
              >
                <Text style={styles.adhocConfirmBtnText}>
                  {language === 'ko' ? '확인' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isConfirmed && setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalContent, { backgroundColor: colors.surface }]}>
            {isConfirmed ? (
              <View style={styles.successContainer}>
                <View style={[styles.successIconCircle, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                </View>
                <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
                  {language === 'ko' ? '요청 완료!' : 'Request Sent!'}
                </Text>
                <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                  {language === 'ko'
                    ? '팀원들에게 출석 여부 요청이 전송됩니다.'
                    : 'Team members will receive availability requests.'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.confirmModalHeader}>
                  <View style={[styles.confirmModalIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="send" size={32} color={colors.primary} />
                  </View>
                  <Text style={[styles.confirmModalTitle, { color: colors.textPrimary }]}>
                    {language === 'ko' ? '출석 요청 확인' : 'Confirm Request'}
                  </Text>
                  <Text style={[styles.confirmModalSubtitle, { color: colors.textSecondary }]}>
                    {language === 'ko'
                      ? `${totalSelections}개 예배에 대한 출석 요청을 보냅니다.`
                      : `Request availability for ${totalSelections} services.`}
                  </Text>
                </View>

                {/* Breakdown */}
                <ScrollView style={styles.confirmBreakdown} showsVerticalScrollIndicator={false}>
                  {getSelectionsByServiceType().map(({ serviceType, count, dates, isAdhoc }) => (
                    <View key={isAdhoc ? 'adhoc' : serviceType?.id} style={styles.confirmServiceGroup}>
                      <View style={[styles.confirmServiceHeader, { backgroundColor: isAdhoc ? colors.warning + '10' : colors.primary + '10' }]}>
                        <Text style={[styles.confirmServiceName, { color: isAdhoc ? colors.warning : colors.primary }]}>
                          {isAdhoc ? (language === 'ko' ? '특별 일정' : 'Special') : serviceType?.name}
                        </Text>
                        <Text style={[styles.confirmServiceCount, { color: isAdhoc ? colors.warning : colors.primary }]}>
                          {count}{language === 'ko' ? '회' : ' times'}
                        </Text>
                      </View>
                      <View style={styles.confirmDates}>
                        {dates.slice(0, 4).map((dateStr) => {
                          const date = parseLocalDate(dateStr);
                          return (
                            <Text key={dateStr} style={[styles.confirmDateText, { color: colors.textSecondary }]}>
                              • {language === 'ko'
                                ? date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                                : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          );
                        })}
                        {dates.length > 4 && (
                          <Text style={[styles.confirmDateText, { color: colors.textMuted }]}>
                            {language === 'ko' ? `외 ${dates.length - 4}개...` : `+${dates.length - 4} more...`}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.confirmModalActions}>
                  <TouchableOpacity
                    style={[styles.confirmModalCancel, { borderColor: colors.border }, isSending && { opacity: 0.5 }]}
                    onPress={() => setShowConfirmModal(false)}
                    disabled={isSending}
                  >
                    <Text style={[styles.confirmModalCancelText, { color: colors.textSecondary }]}>
                      {language === 'ko' ? '취소' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmModalSend, { backgroundColor: colors.primary }, isSending && { opacity: 0.8 }]}
                    onPress={handleConfirm}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.confirmModalSendText}>
                          {language === 'ko' ? '전송 중...' : 'Sending...'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.confirmModalSendText}>
                          {language === 'ko' ? '요청 보내기' : 'Send Request'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  notifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  notifiedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifiedTextContainer: {
    flex: 1,
  },
  notifiedTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  notifiedSubtext: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  purposeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  purposeText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  calendarCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    ...shadows.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  monthButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  monthTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  loadingContainer: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  daySelected: {
    shadowColor: '#D4A574',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayToday: {
    borderWidth: 2,
  },
  dayText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  serviceDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    gap: 2,
  },
  serviceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  selectionBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  todayLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendDotsExample: {
    flexDirection: 'row',
    gap: 2,
  },
  legendText: {
    fontSize: fontSize.xs,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  quickActionText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  summaryCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  summaryBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  summaryItemName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  summaryItemCount: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 100,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 0.5,
  },
  confirmButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  // Service Selector Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  serviceModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  serviceModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  serviceModalDate: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  serviceModalSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  serviceOptions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  serviceOptionInfo: {
    flex: 1,
  },
  serviceOptionName: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  serviceOptionTime: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  serviceOptionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceModalDone: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  serviceModalDoneText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  // Confirmation Modal
  confirmModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
    ...shadows.lg,
  },
  confirmModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmModalTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  confirmModalSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  confirmBreakdown: {
    maxHeight: 200,
    marginVertical: spacing.md,
  },
  confirmServiceGroup: {
    marginBottom: spacing.md,
  },
  confirmServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  confirmServiceName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  confirmServiceCount: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  confirmDates: {
    paddingLeft: spacing.md,
  },
  confirmDateText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  confirmModalCancel: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  confirmModalCancelText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  confirmModalSend: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  confirmModalSendText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  // Ad-hoc Modal Styles
  adhocModalContent: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  adhocServiceList: {
    maxHeight: 350,
    marginBottom: spacing.md,
  },
  adhocServiceItem: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'visible',
  },
  adhocServiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  adhocServiceNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  adhocServiceNumberText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  adhocServiceTitle: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  adhocRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adhocTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  adhocTimeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  adhocTimeLabelText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  adhocTimeOptional: {
    fontSize: fontSize.xs,
  },
  adhocTimeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  adhocPracticeValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adhocAddPracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  adhocAddPracticeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  adhocTimeValueText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  adhocAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  adhocAddBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  adhocModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  adhocCancelBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  adhocCancelBtnText: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  adhocConfirmBtn: {
    flex: 2,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  adhocConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.base,
    fontWeight: '700',
  },
  inlinePickerContainer: {
    // Container for the time picker trigger (display="default" opens modal)
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  inlinePicker: {
    // Unused when display="default", kept for potential future use
    height: 180,
    width: '100%',
  },
});
