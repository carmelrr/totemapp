/**
 * @fileoverview My Shift Tasks Screen (Worker)
 * @description The worker's checklist for their current/next assigned shift,
 *  grouped by list, with progress. Checking writes done/doneAt.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { auth } from '@/features/data/firebase';
import { useShifts } from '../hooks';
import { useMyShiftTasks } from '../tasksHooks';
import { setTaskDone } from '../tasksService';
import type { Shift, ShiftTask } from '../types';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function MyTasksScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const filter = useMemo(() => ({ dateFrom: startOfToday() }), []);
  const { shifts, loading: shiftsLoading } = useShifts(filter);

  const myShifts = useMemo(() => {
    const now = Date.now();
    return shifts
      .filter((s) => s.assignedWorkerIds.includes(uid) && s.endTime.getTime() >= now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [shifts, uid]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedShift: Shift | null =
    myShifts.find((s) => s.id === selectedId) || myShifts[0] || null;
  const { tasks, loading: tasksLoading } = useMyShiftTasks(selectedShift?.id || null);

  const groups = useMemo(() => {
    const m = new Map<string, ShiftTask[]>();
    for (const t of tasks) {
      const arr = m.get(t.listName);
      if (arr) arr.push(t);
      else m.set(t.listName, [t]);
    }
    return [...m.entries()];
  }, [tasks]);

  const totalDone = tasks.filter((t) => t.done).length;
  const styles = createStyles(theme);

  const toggle = async (task: ShiftTask) => {
    try {
      await setTaskDone(task.id, !task.done);
    } catch (e) {
      // optimistic UI not used; snapshot will reflect the true state
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>המשמרת שלי</Text>
        <View style={{ width: 40 }} />
      </View>

      {shiftsLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : myShifts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyText}>אין לך משמרות מאושרות קרובות.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {myShifts.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {myShifts.map((s) => {
                const active = s.id === (selectedShift?.id || '');
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, active && { backgroundColor: theme.buttonPrimary }]}
                    onPress={() => setSelectedId(s.id)}
                  >
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>
                      {s.title || 'משמרת'} · {fmtTime(s.startTime)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedShift && (
            <View style={styles.shiftCard}>
              <Text style={styles.shiftTitle}>{selectedShift.title || 'משמרת'}</Text>
              <Text style={styles.shiftSub}>
                {fmtDate(selectedShift.startTime)} · {fmtTime(selectedShift.startTime)}–
                {fmtTime(selectedShift.endTime)}
              </Text>
              {tasks.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>התקדמות כללית</Text>
                    <Text style={styles.progressLabel}>
                      {totalDone}/{tasks.length}
                    </Text>
                  </View>
                  <ProgressBar value={tasks.length ? totalDone / tasks.length : 0} theme={theme} />
                </View>
              )}
            </View>
          )}

          {tasksLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={theme.primary} />
          ) : tasks.length === 0 ? (
            <Text style={styles.noTasks}>אין משימות למשמרת הזו.</Text>
          ) : (
            groups.map(([listName, groupTasks]) => {
              const done = groupTasks.filter((t) => t.done).length;
              return (
                <View key={listName} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>{listName}</Text>
                    <View
                      style={[
                        styles.groupBadge,
                        done === groupTasks.length && { backgroundColor: theme.success + '25' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupBadgeText,
                          done === groupTasks.length && { color: theme.success },
                        ]}
                      >
                        {done}/{groupTasks.length}
                      </Text>
                    </View>
                  </View>
                  <ProgressBar value={done / groupTasks.length} theme={theme} />
                  {groupTasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      style={styles.taskRow}
                      onPress={() => toggle(task)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={task.done ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={task.done ? theme.success : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.taskText,
                          task.done && { textDecorationLine: 'line-through', color: theme.textSecondary },
                        ]}
                      >
                        {task.title}
                      </Text>
                      {task.source === 'manager' && (
                        <View style={styles.mgrBadge}>
                          <Text style={styles.mgrBadgeText}>מהמנהל</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ProgressBar({ value, theme }: { value: number; theme: any }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: theme.primary }} />
    </View>
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
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 },
    emptyText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginLeft: 8,
    },
    chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
    shiftCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16 },
    shiftTitle: { fontSize: 18, fontWeight: '700', color: theme.text, writingDirection: 'rtl', textAlign: 'right' },
    shiftSub: { fontSize: 13, color: theme.textSecondary, marginTop: 4, writingDirection: 'rtl', textAlign: 'right' },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 12, color: theme.textSecondary },
    noTasks: { color: theme.textSecondary, textAlign: 'center', marginTop: 24 },
    group: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginTop: 12 },
    groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    groupTitle: { fontSize: 16, fontWeight: '700', color: theme.text, writingDirection: 'rtl' },
    groupBadge: { backgroundColor: theme.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    groupBadgeText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    taskText: { flex: 1, fontSize: 15, color: theme.text, writingDirection: 'rtl', textAlign: 'right' },
    mgrBadge: { borderWidth: 1, borderColor: theme.primary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
    mgrBadgeText: { fontSize: 10, color: theme.primary, fontWeight: '600' },
  });
