/**
 * @fileoverview Shift Editor Screen (Admin)
 * @description Screen for creating and editing shifts
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/features/theme/ThemeContext';
import { useShiftRoles } from '../hooks';
import { createShift, updateShift, createRecurringShifts } from '../shiftsService';
import { RECURRENCE_CONFIG, DAYS_OF_WEEK_HE } from '../constants';
import type { Shift, RecurrenceType, RecurrencePattern } from '../types';
import { auth } from '@/features/data/firebase';

interface ShiftEditorScreenProps {
  navigation: any;
  route: {
    params?: {
      shift?: Shift;
    };
  };
}

export function ShiftEditorScreen({ navigation, route }: ShiftEditorScreenProps) {
  const { theme } = useTheme();
  const existingShift = route.params?.shift;
  const { roles } = useShiftRoles();

  // Helper to safely convert any date-like value to a Date
  const toSafeDate = (val: any, fallback: Date): Date => {
    if (!val) return fallback;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (val?.toDate) return val.toDate(); // Firestore Timestamp
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d;
  };

  // Form state
  const [title, setTitle] = useState(existingShift?.title || '');
  const [description, setDescription] = useState(existingShift?.description || '');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(existingShift?.requiredRoleIds || []);
  const [startTime, setStartTime] = useState(toSafeDate(existingShift?.startTime, new Date()));
  const [endTime, setEndTime] = useState(toSafeDate(existingShift?.endTime, new Date(Date.now() + 4 * 60 * 60 * 1000)));
  const [maxWorkers, setMaxWorkers] = useState(String(existingShift?.maxWorkers || 2));
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(existingShift?.recurrence?.type || 'none');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>(existingShift?.recurrence?.daysOfWeek || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>(
    toSafeDate(existingShift?.recurrence?.endDate, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  );

  // Date picker visibility state
  const [showStartDate, setShowStartDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  const [saving, setSaving] = useState(false);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleDay = (day: number) => {
    setSelectedDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  /** Generate recurring dates based on recurrence settings */
  const generateRecurringDates = useCallback((): Date[] => {
    const dates: Date[] = [];
    const start = new Date(startTime);
    const end = new Date(recurrenceEndDate);
    const current = new Date(start);

    while (current <= end) {
      if (recurrenceType === 'daily') {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      } else if (recurrenceType === 'weekly' || recurrenceType === 'biweekly') {
        if (selectedDaysOfWeek.includes(current.getDay())) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
        // For biweekly, skip a week after completing one
        if (recurrenceType === 'biweekly' && current.getDay() === 0 && dates.length > 0) {
          const lastDate = dates[dates.length - 1];
          const daysDiff = Math.floor((current.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 7) {
            current.setDate(current.getDate() + 7);
          }
        }
      } else if (recurrenceType === 'monthly') {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }

      // Safety: max 365 dates
      if (dates.length >= 365) break;
    }

    return dates;
  }, [startTime, recurrenceEndDate, recurrenceType, selectedDaysOfWeek]);

  const handleSave = async () => {
    if (selectedRoleIds.length === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות תפקיד אחד');
      return;
    }
    if (endTime <= startTime) {
      Alert.alert('שגיאה', 'שעת סיום חייבת להיות אחרי שעת התחלה');
      return;
    }
    const workers = parseInt(maxWorkers) || 1;

    setSaving(true);
    try {
      const recurrence: RecurrencePattern = {
        type: recurrenceType,
        daysOfWeek: recurrenceType === 'weekly' || recurrenceType === 'biweekly' ? selectedDaysOfWeek : undefined,
        endDate: recurrenceType !== 'none' ? recurrenceEndDate : undefined,
      };

      if (existingShift) {
        // Update existing
        await updateShift(existingShift.id, {
          title: title || undefined,
          description: description || undefined,
          requiredRoleIds: selectedRoleIds,
          startTime,
          endTime,
          maxWorkers: workers,
          recurrence,
        });
      } else if (recurrenceType !== 'none') {
        // Create recurring shifts
        const dates = generateRecurringDates();
        if (dates.length === 0) {
          Alert.alert('שגיאה', 'לא נוצרו תאריכים. בדוק את הגדרות החזרתיות.');
          setSaving(false);
          return;
        }
        await createRecurringShifts(
          {
            requiredRoleIds: selectedRoleIds,
            title: title || undefined,
            description: description || undefined,
            startTime,
            endTime,
            maxWorkers: workers,
            status: 'open',
            recurrence,
            assignedWorkerIds: [],
            createdBy: auth.currentUser?.uid || '',
          },
          dates
        );
        Alert.alert('הצלחה', `נוצרו ${dates.length} משמרות`);
      } else {
        // Create single shift
        await createShift({
          requiredRoleIds: selectedRoleIds,
          title: title || undefined,
          description: description || undefined,
          startTime,
          endTime,
          maxWorkers: workers,
          status: 'open',
          recurrence: { type: 'none' },
          assignedWorkerIds: [],
          createdBy: auth.currentUser?.uid || '',
        });
      }
      navigation.goBack();
    } catch (error: any) {
      console.error('Shift save error:', error);
      Alert.alert('שגיאה', `לא ניתן לשמור את המשמרת: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: Date) => d.toLocaleDateString('he-IL');
  const formatTime = (d: Date) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{existingShift ? 'עריכת משמרת' : 'משמרת חדשה'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Title */}
        <Text style={styles.label}>כותרת (אופציונלי)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="לדוגמה: משמרת בוקר"
          placeholderTextColor={theme.textSecondary}
          textAlign="right"
        />

        {/* Description */}
        <Text style={styles.label}>תיאור (אופציונלי)</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="הערות נוספות..."
          placeholderTextColor={theme.textSecondary}
          multiline
          textAlign="right"
        />

        {/* Required Roles */}
        <Text style={styles.label}>תפקידים נדרשים</Text>
        <View style={styles.rolesGrid}>
          {roles.filter((r) => r.isActive).map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.roleChip,
                selectedRoleIds.includes(role.id) && { backgroundColor: role.color + '20', borderColor: role.color },
              ]}
              onPress={() => toggleRole(role.id)}
            >
              <Text style={{ fontSize: 16 }}>{role.icon}</Text>
              <Text
                style={[
                  styles.roleChipText,
                  selectedRoleIds.includes(role.id) && { color: role.color },
                ]}
              >
                {role.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date & Time */}
        <Text style={styles.sectionTitle}>תאריך ושעה</Text>

        <TouchableOpacity style={styles.dateRow} onPress={() => setShowStartDate(true)}>
          <Text style={styles.dateLabel}>תאריך</Text>
          <Text style={styles.dateValue}>{formatDate(startTime)}</Text>
        </TouchableOpacity>
        {showStartDate && (
          <DateTimePicker
            value={startTime}
            mode="date"
            onChange={(_, d) => {
              setShowStartDate(false);
              if (d) {
                const newStart = new Date(d);
                newStart.setHours(startTime.getHours(), startTime.getMinutes());
                setStartTime(newStart);
                const newEnd = new Date(d);
                newEnd.setHours(endTime.getHours(), endTime.getMinutes());
                setEndTime(newEnd);
              }
            }}
          />
        )}

        <TouchableOpacity style={styles.dateRow} onPress={() => setShowStartTime(true)}>
          <Text style={styles.dateLabel}>שעת התחלה</Text>
          <Text style={styles.dateValue}>{formatTime(startTime)}</Text>
        </TouchableOpacity>
        {showStartTime && (
          <DateTimePicker
            value={startTime}
            mode="time"
            is24Hour
            onChange={(_, d) => {
              setShowStartTime(false);
              if (d) setStartTime(d);
            }}
          />
        )}

        <TouchableOpacity style={styles.dateRow} onPress={() => setShowEndTime(true)}>
          <Text style={styles.dateLabel}>שעת סיום</Text>
          <Text style={styles.dateValue}>{formatTime(endTime)}</Text>
        </TouchableOpacity>
        {showEndTime && (
          <DateTimePicker
            value={endTime}
            mode="time"
            is24Hour
            onChange={(_, d) => {
              setShowEndTime(false);
              if (d) setEndTime(d);
            }}
          />
        )}

        {/* Max Workers */}
        <Text style={styles.label}>מספר עובדים מקסימלי</Text>
        <TextInput
          style={styles.input}
          value={maxWorkers}
          onChangeText={setMaxWorkers}
          keyboardType="numeric"
          textAlign="center"
        />

        {/* Recurrence */}
        <Text style={styles.sectionTitle}>חזרתיות</Text>
        <View style={styles.recurrenceRow}>
          {(Object.keys(RECURRENCE_CONFIG) as RecurrenceType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.recurrenceChip,
                recurrenceType === type && { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary },
              ]}
              onPress={() => setRecurrenceType(type)}
            >
              <Text
                style={[
                  styles.recurrenceChipText,
                  recurrenceType === type && { color: '#fff' },
                ]}
              >
                {RECURRENCE_CONFIG[type].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (
          <>
            <Text style={styles.label}>ימים בשבוע</Text>
            <View style={styles.daysRow}>
              {DAYS_OF_WEEK_HE.map((day, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.dayChip,
                    selectedDaysOfWeek.includes(i) && { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary },
                  ]}
                  onPress={() => toggleDay(i)}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      selectedDaysOfWeek.includes(i) && { color: '#fff' },
                    ]}
                  >
                    {day.substring(0, 2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {recurrenceType !== 'none' && (
          <>
            <TouchableOpacity style={styles.dateRow} onPress={() => setShowEndDate(true)}>
              <Text style={styles.dateLabel}>סיום חזרתיות</Text>
              <Text style={styles.dateValue}>{formatDate(recurrenceEndDate)}</Text>
            </TouchableOpacity>
            {showEndDate && (
              <DateTimePicker
                value={recurrenceEndDate}
                mode="date"
                onChange={(_, d) => {
                  setShowEndDate(false);
                  if (d) setRecurrenceEndDate(d);
                }}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{existingShift ? 'עדכן' : 'צור משמרת'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

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
    backBtn: { width: 40 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    content: { flex: 1, padding: 16 },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6, marginTop: 16, writingDirection: 'rtl' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 24, marginBottom: 8, writingDirection: 'rtl' },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    roleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    roleChipText: { fontSize: 14, color: theme.text, fontWeight: '500' },
    dateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dateLabel: { fontSize: 14, color: theme.textSecondary, writingDirection: 'rtl' },
    dateValue: { fontSize: 15, fontWeight: '600', color: theme.text },
    recurrenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    recurrenceChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    recurrenceChipText: { fontSize: 13, color: theme.text, fontWeight: '500' },
    daysRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
    dayChip: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    dayChipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
    footer: { padding: 16, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
    saveBtn: {
      backgroundColor: theme.buttonPrimary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
