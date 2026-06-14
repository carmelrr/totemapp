/**
 * @fileoverview Shifts Calendar Screen
 * @description Main shifts view with day/week/month calendar views
 * Visible only to wall employees (workers with shift roles)
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useRoles } from '@/features/roles';
import { useShifts, useShiftRoles, useMyShiftRoles, useShiftsWithDetails, useIncomingSwapRequests } from '../hooks';
import { SHIFT_STATUS_CONFIG, DAYS_OF_WEEK_HE, REGISTRATION_STATUS_CONFIG } from '../constants';
import { acceptSwapRequest, rejectSwapRequest, getShift } from '../shiftsService';
import type { Shift, ShiftWithDetails, CalendarViewMode, ShiftFilter, ShiftRole, ShiftSwapRequest } from '../types';
import { auth } from '@/features/data/firebase';
import { registerStaffPushToken } from '@/features/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Get a local date key (YYYY-MM-DD) without timezone shift */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface ShiftsCalendarScreenProps {
  navigation: any;
}

export function ShiftsCalendarScreen({ navigation }: ShiftsCalendarScreenProps) {
  const { theme } = useTheme();
  const { isAdmin } = useRoles();
  const { roles } = useShiftRoles();
  const { userShiftRole, isWorker, isShiftManager } = useMyShiftRoles();
  const { requests: incomingSwaps } = useIncomingSwapRequests();
  const canManage = isAdmin || isShiftManager;

  // Register the device for push only for staff (workers/managers) — not climbers.
  React.useEffect(() => {
    if (isWorker || isShiftManager) {
      registerStaffPushToken();
    }
  }, [isWorker, isShiftManager]);

  // Block hardware back button – require explicit navigation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert('יציאה ממשמרות', 'לצאת ממסך המשמרות?', [
          { text: 'לא', style: 'cancel' },
          { text: 'כן', onPress: () => navigation.goBack() },
        ]);
        return true; // prevent default back
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);

  // Calculate date range for the view
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { dateFrom: start, dateTo: end };
  }, [currentDate, viewMode]);

  const filter: ShiftFilter = {
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
    status: (selectedStatusFilter as any) || undefined,
    roleId: selectedRoleFilter || undefined,
  };

  // Single subscription – admin sees everything, worker sees only matching roles
  const { shifts: allShifts, loading } = useShifts(filter);

  const shifts = useMemo(() => {
    if (isAdmin || !userShiftRole?.isActive) return allShifts;
    const myRoleIds = new Set(userShiftRole.shiftRoleIds);
    return allShifts.filter((s) => s.requiredRoleIds.some((id) => myRoleIds.has(id)));
  }, [allShifts, isAdmin, userShiftRole]);

  const shiftsWithDetails = useShiftsWithDetails(shifts, roles);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const formatDateRange = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
    } else if (viewMode === 'week') {
      const start = new Date(dateRange.dateFrom);
      const end = new Date(dateRange.dateTo);
      return `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}`;
    } else {
      return currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    }
  };

  // Group shifts by day for week/month views
  const shiftsByDay = useMemo(() => {
    const map = new Map<string, ShiftWithDetails[]>();
    shiftsWithDetails.forEach((shift) => {
      const key = localDateKey(shift.startTime);
      const existing = map.get(key) || [];
      existing.push(shift);
      map.set(key, existing);
    });
    return map;
  }, [shiftsWithDetails]);

  // Generate days for the view
  const days = useMemo(() => {
    const result: Date[] = [];
    const d = new Date(dateRange.dateFrom);
    while (d <= dateRange.dateTo) {
      result.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [dateRange]);

  const styles = createStyles(theme);

  const handleAcceptSwap = (swap: ShiftSwapRequest) => {
    Alert.alert(
      'קבלת החלפה',
      `לקחת את המשמרת מ-${swap.requesterName}?`,
      [
        { text: 'לא', style: 'cancel' },
        {
          text: 'כן, קח',
          onPress: async () => {
            try {
              await acceptSwapRequest(swap.id);
              Alert.alert('הצלחה', 'המשמרת הועברה אליך!');
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'לא ניתן לקבל את ההחלפה');
            }
          },
        },
      ]
    );
  };

  const handleRejectSwap = (swap: ShiftSwapRequest) => {
    Alert.alert(
      'דחיית החלפה',
      `לדחות את בקשת ההחלפה מ-${swap.requesterName}?`,
      [
        { text: 'לא', style: 'cancel' },
        {
          text: 'דחה',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectSwapRequest(swap.id);
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'לא ניתן לדחות את הבקשה');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>משמרות</Text>
        {isAdmin && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('ShiftRolesManagement')}>
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ShiftEditor')}>
              <Ionicons name="add-circle-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Staff quick actions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
      >
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('MyTasks')}>
          <Ionicons name="checkbox-outline" size={16} color={theme.buttonPrimary} />
          <Text style={styles.quickBtnText}>המשמרת שלי</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('QA')}>
          <Ionicons name="help-circle-outline" size={16} color={theme.buttonPrimary} />
          <Text style={styles.quickBtnText}>שאלות</Text>
        </TouchableOpacity>
        {canManage && (
          <>
            <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('TaskListsManagement')}>
              <Ionicons name="list-outline" size={16} color={theme.buttonPrimary} />
              <Text style={styles.quickBtnText}>קבוצות משימות</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('QAAdmin')}>
              <Ionicons name="chatbubbles-outline" size={16} color={theme.buttonPrimary} />
              <Text style={styles.quickBtnText}>ניהול שו"ת</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Incoming Swap Requests Banner */}
      {incomingSwaps.length > 0 && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerTitle}>
            🔄 בקשות החלפה ({incomingSwaps.length})
          </Text>
          {incomingSwaps.map((swap) => (
            <View key={swap.id} style={styles.swapRequestCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapRequestText}>
                  {swap.requesterName} מבקש/ת שתיקח את המשמרת
                </Text>
                {swap.message ? (
                  <Text style={styles.swapRequestMessage}>"{swap.message}"</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => handleAcceptSwap(swap)} style={{ padding: 4 }}>
                  <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRejectSwap(swap)} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={32} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* View Mode Selector */}
      <View style={styles.viewModeRow}>
        {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.viewModeBtn, viewMode === mode && styles.viewModeBtnActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.viewModeBtnText, viewMode === mode && styles.viewModeBtnTextActive]}>
              {mode === 'day' ? 'יום' : mode === 'week' ? 'שבוע' : 'חודש'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goPrev}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday}>
          <Text style={styles.dateNavText}>{formatDateRange()}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goNext}>
          <Ionicons name="chevron-forward" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Role Filter */}
      {roles.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedRoleFilter && styles.filterChipActive]}
            onPress={() => setSelectedRoleFilter(null)}
          >
            <Text style={[styles.filterChipText, !selectedRoleFilter && styles.filterChipTextActive]}>הכל</Text>
          </TouchableOpacity>
          {roles.filter((r) => r.isActive).map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.filterChip,
                selectedRoleFilter === role.id && { backgroundColor: role.color + '20', borderColor: role.color },
              ]}
              onPress={() => setSelectedRoleFilter(selectedRoleFilter === role.id ? null : role.id)}
            >
              <Text style={[styles.filterChipText, selectedRoleFilter === role.id && { color: role.color }]}>
                {role.icon} {role.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} size="large" />
      ) : viewMode === 'day' ? (
        <DayView
          shifts={shiftsWithDetails}
          theme={theme}
          isAdmin={isAdmin}
          onShiftPress={(shift) => navigation.navigate('ShiftDetail', { shift })}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
          {days.map((day) => {
            const key = localDateKey(day);
            const dayShifts = shiftsByDay.get(key) || [];
            const isToday = key === localDateKey(new Date());

            return (
              <View key={key} style={[styles.daySection, isToday && { borderLeftWidth: 3, borderLeftColor: theme.buttonPrimary }]}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, isToday && { color: theme.buttonPrimary, fontWeight: '700' }]}>
                    {DAYS_OF_WEEK_HE[day.getDay()]}
                  </Text>
                  <Text style={[styles.dayDate, isToday && { color: theme.buttonPrimary }]}>
                    {day.getDate()}/{day.getMonth() + 1}
                  </Text>
                </View>
                {dayShifts.length === 0 ? (
                  <Text style={styles.noShifts}>אין משמרות</Text>
                ) : (
                  dayShifts.map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      theme={theme}
                      isAdmin={isAdmin}
                      onPress={() => navigation.navigate('ShiftDetail', { shift })}
                    />
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* FAB for admin */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('ShiftEditor')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ==================== Day View ====================

function DayView({
  shifts,
  theme,
  isAdmin,
  onShiftPress,
}: {
  shifts: ShiftWithDetails[];
  theme: any;
  isAdmin: boolean;
  onShiftPress: (shift: ShiftWithDetails) => void;
}) {
  if (shifts.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="calendar-outline" size={48} color={theme.textSecondary} />
        <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 12 }}>אין משמרות ביום זה</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={shifts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <ShiftCard shift={item} theme={theme} isAdmin={isAdmin} onPress={() => onShiftPress(item)} expanded />
      )}
    />
  );
}

// ==================== Shift Card ====================

function ShiftCard({
  shift,
  theme,
  isAdmin,
  onPress,
  expanded = false,
}: {
  shift: ShiftWithDetails;
  theme: any;
  isAdmin: boolean;
  onPress: () => void;
  expanded?: boolean;
}) {
  const statusConfig = SHIFT_STATUS_CONFIG[shift.status];
  const formatTime = (d: Date) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: expanded ? 16 : 12,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: shift.roles[0]?.color || statusConfig.color,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          {shift.title ? (
            <Text style={{ fontSize: expanded ? 17 : 15, fontWeight: '700', color: theme.text, writingDirection: 'rtl' as const }}>
              {shift.title}
            </Text>
          ) : null}
          <Text style={{ fontSize: 14, color: theme.text, marginTop: 2 }}>
            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {shift.roles.map((role) => (
              <View
                key={role.id}
                style={{ backgroundColor: role.color + '15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}
              >
                <Text style={{ color: role.color, fontSize: 11, fontWeight: '600' }}>
                  {role.icon} {role.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: statusConfig.color + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: statusConfig.color, fontSize: 11, fontWeight: '600' }}>{statusConfig.label}</Text>
          </View>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
            {shift.approvedCount}/{shift.maxWorkers} 👷
          </Text>
          {shift.userRegistration && (
            <View style={{ marginTop: 4, backgroundColor: REGISTRATION_STATUS_CONFIG[shift.userRegistration.status].color + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, color: REGISTRATION_STATUS_CONFIG[shift.userRegistration.status].color, fontWeight: '600' }}>
                {REGISTRATION_STATUS_CONFIG[shift.userRegistration.status].icon} {REGISTRATION_STATUS_CONFIG[shift.userRegistration.status].label}
              </Text>
            </View>
          )}
        </View>
      </View>

      {expanded && shift.description ? (
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8, writingDirection: 'rtl' as const }}>
          {shift.description}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ==================== Styles ====================

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.headerGradient,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    quickRow: { maxHeight: 48, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border, paddingVertical: 8 },
    quickBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.buttonPrimary + '40',
      backgroundColor: theme.buttonPrimary + '12',
    },
    quickBtnText: { fontSize: 13, color: theme.buttonPrimary, fontWeight: '600' },
    viewModeRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      padding: 4,
      margin: 12,
      borderRadius: 12,
    },
    viewModeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 10,
    },
    viewModeBtnActive: {
      backgroundColor: theme.buttonPrimary,
    },
    viewModeBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    viewModeBtnTextActive: { color: '#fff' },
    dateNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    dateNavText: { fontSize: 16, fontWeight: '700', color: theme.text },
    filterRow: { maxHeight: 44, marginBottom: 8 },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    filterChipActive: {
      backgroundColor: theme.buttonPrimary + '20',
      borderColor: theme.buttonPrimary,
    },
    filterChipText: { fontSize: 13, color: theme.text, fontWeight: '500' },
    filterChipTextActive: { color: theme.buttonPrimary },
    daySection: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderLeftWidth: 1,
      borderLeftColor: 'transparent',
      marginLeft: 12,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    dayName: { fontSize: 14, fontWeight: '600', color: theme.text },
    dayDate: { fontSize: 13, color: theme.textSecondary },
    noShifts: { fontSize: 13, color: theme.textSecondary, fontStyle: 'italic', paddingVertical: 4 },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    swapBanner: {
      backgroundColor: '#8B5CF620',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#8B5CF640',
    },
    swapBannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#8B5CF6',
      writingDirection: 'rtl' as const,
      marginBottom: 8,
    },
    swapRequestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 6,
    },
    swapRequestText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      writingDirection: 'rtl' as const,
    },
    swapRequestMessage: {
      fontSize: 12,
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginTop: 2,
      writingDirection: 'rtl' as const,
    },
  });
