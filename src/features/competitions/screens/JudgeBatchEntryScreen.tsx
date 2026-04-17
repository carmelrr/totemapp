/**
 * @fileoverview Judge Batch Entry Screen
 * @description Fast "per-participant, all routes, one save" data entry flow
 * for simple competition formats (national league, totemtition, points).
 * For zone_top we still redirect judges to the classic per-route modal screen
 * because that flow has too many fields to batch safely.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useAuth } from '@/context/AuthContext';
import { useRolesContext } from '@/features/roles/RolesContext';
import {
  useCompetition,
  useParticipants,
  useCompetitionRoutes,
} from '@/features/competitions/hooks/useCompetition';
import { ResultsService } from '@/features/competitions/services/ResultsService';
import { isZoneTopFormat } from '@/features/competitions/constants';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/features/data/firebase';
import type {
  Participant,
  CompetitionRoute,
  RouteResult,
} from '@/features/competitions/types';
import { CachedAvatar } from '@/components/ui/CachedAvatar';

type DraftRow = {
  route: CompetitionRoute;
  completed: boolean;
  attempts: string;
  existing?: RouteResult;
  dirty: boolean;
};

export default function JudgeBatchEntryScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { competitionId } = route.params;
  const { user } = useAuth();
  const rolesContext = useRolesContext();

  const { competition, loading: compLoading } = useCompetition(competitionId);
  const { participants, loading: partsLoading } = useParticipants(competitionId);
  const { routes, loading: routesLoading } = useCompetitionRoutes(competitionId);

  const isJudge = rolesContext.canEnterResults;

  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [search, setSearch] = useState('');
  const [existingRoutes, setExistingRoutes] =
    useState<Record<number, RouteResult> | null>(null);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const isZoneTop = competition ? isZoneTopFormat(competition.format) : false;

  // Subscribe to current participant's result doc so the draft starts from
  // server state, not stale cache.
  useEffect(() => {
    if (!selectedParticipant || !competitionId) {
      setExistingRoutes(null);
      return;
    }
    const ref = doc(
      db,
      'competitions',
      competitionId,
      'results',
      selectedParticipant.userId
    );
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setExistingRoutes({});
          return;
        }
        const data = snap.data() as any;
        const r = data?.routes;
        if (!r) {
          setExistingRoutes({});
          return;
        }
        if (Array.isArray(r)) {
          const map: Record<number, RouteResult> = {};
          r.forEach((rr: RouteResult) => {
            if (typeof rr.routeNumber === 'number') map[rr.routeNumber] = rr;
          });
          setExistingRoutes(map);
        } else {
          setExistingRoutes(r as Record<number, RouteResult>);
        }
      },
      (err) => {
        console.warn('[BatchEntry] result subscribe failed', err);
        setExistingRoutes({});
      }
    );
    return () => unsub();
  }, [selectedParticipant, competitionId]);

  // Rebuild the draft whenever the participant or server state changes.
  useEffect(() => {
    if (!selectedParticipant || !routes || !existingRoutes) {
      setDraft([]);
      return;
    }
    const sorted = [...routes].sort(
      (a, b) => (a.routeNumber || 0) - (b.routeNumber || 0)
    );
    const rows: DraftRow[] = sorted.map((r) => {
      const ex = existingRoutes[r.routeNumber!];
      return {
        route: r,
        completed: !!ex?.completed,
        attempts: ex ? String(ex.attempts ?? 1) : '1',
        existing: ex,
        dirty: false,
      };
    });
    setDraft(rows);
  }, [selectedParticipant, routes, existingRoutes]);

  const filteredParticipants = useMemo(() => {
    if (!participants) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? participants.filter((p) =>
          (p.name || '').toLowerCase().includes(q)
        )
      : participants;
    return list.slice().sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'he')
    );
  }, [participants, search]);

  const dirtyCount = useMemo(
    () => draft.filter((d) => d.dirty).length,
    [draft]
  );

  const setRow = (idx: number, patch: Partial<DraftRow>) => {
    setDraft((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch, dirty: true };
      return next;
    });
  };

  const handleSaveAll = async () => {
    if (!selectedParticipant || !competition || !user) return;
    const maxAttempts = competition.settings.maxAttempts || 10;
    const changes = draft.filter((d) => d.dirty);
    if (changes.length === 0) {
      Alert.alert('אין שינויים', 'לא עודכנו תוצאות לשמירה.');
      return;
    }
    // Validate all before sending.
    for (const row of changes) {
      const att = parseInt(row.attempts, 10);
      if (row.completed) {
        if (!Number.isFinite(att) || att < 1 || att > maxAttempts) {
          Alert.alert(
            'שגיאה',
            `מספר הניסיונות במסלול #${row.route.routeNumber} חייב להיות בין 1 ל-${maxAttempts}`
          );
          return;
        }
      }
    }

    setSaving(true);
    let ok = 0;
    let fail = 0;
    for (const row of changes) {
      try {
        const attemptsNum = parseInt(row.attempts, 10) || 1;
        await ResultsService.enterRouteResult(
          competitionId,
          selectedParticipant.userId,
          row.route.routeNumber!,
          {
            routeId: row.route.id,
            grade: row.route.grade,
            completed: row.completed,
            attempts: row.completed ? attemptsNum : 0,
          },
          user.uid,
          false,
          competition
        );
        ok += 1;
      } catch (e: any) {
        console.warn('[BatchEntry] save failed', e);
        fail += 1;
      }
    }
    setSaving(false);

    if (fail === 0) {
      Alert.alert('נשמר', `${ok} תוצאות נשמרו בהצלחה`);
    } else {
      Alert.alert(
        'שמירה חלקית',
        `נשמרו: ${ok}\nנכשלו: ${fail}`
      );
    }
  };

  // -- Render ---------------------------------------------------------------

  if (compLoading || partsLoading || routesLoading) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!competition) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]}>
        <Text style={styles.emptyText}>התחרות לא נמצאה</Text>
      </SafeAreaView>
    );
  }

  if (!isJudge) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]}>
        <Text style={styles.emptyText}>אין הרשאה להזין תוצאות</Text>
      </SafeAreaView>
    );
  }

  if (isZoneTop) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]}>
        <Text style={styles.emptyText}>
          הזנה קבוצתית אינה זמינה לפורמט Zone/Top. השתמש במסך ההזנה הרגיל.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() =>
            navigation.replace('JudgeEntry', { competitionId })
          }
        >
          <Text style={styles.primaryBtnText}>עבור להזנה רגילה</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-forward" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          הזנה קבוצתית — {competition.name}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {!selectedParticipant ? (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="חפש מתחרה..."
            placeholderTextColor={theme.textSecondary}
            style={styles.searchInput}
          />
          <FlatList
            data={filteredParticipants}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.participantRow}
                onPress={() => setSelectedParticipant(item)}
                activeOpacity={0.7}
              >
                <CachedAvatar
                  photoURL={(item as any).photoURL}
                  displayName={item.name || '?'}
                  size={40}
                  showBorder={false}
                />
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={styles.participantName}>{item.name}</Text>
                  {(item as any).categoryName && (
                    <Text style={styles.participantMeta}>
                      {(item as any).categoryName}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>אין מתחרים להצגה</Text>
            }
          />
        </>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.selectedBanner}>
            <Text style={styles.participantName}>
              {selectedParticipant.name}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedParticipant(null)}
              style={styles.changeBtn}
            >
              <Text style={styles.changeBtnText}>החלף מתחרה</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            {draft.map((row, idx) => (
              <View key={row.route.id} style={styles.routeRow}>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>
                    #{row.route.routeNumber}
                  </Text>
                  <Text style={styles.routeGrade}>
                    {row.route.grade || '—'}
                  </Text>
                </View>

                <View style={styles.routeControls}>
                  <View style={styles.attemptsWrap}>
                    <TouchableOpacity
                      onPress={() => {
                        const n = Math.max(
                          1,
                          (parseInt(row.attempts, 10) || 1) - 1
                        );
                        setRow(idx, { attempts: String(n) });
                      }}
                      style={styles.stepBtn}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      value={row.attempts}
                      onChangeText={(v) =>
                        setRow(idx, {
                          attempts: v.replace(/[^0-9]/g, '') || '',
                        })
                      }
                      keyboardType="numeric"
                      style={styles.attemptsInput}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const max = competition.settings.maxAttempts || 10;
                        const n = Math.min(
                          max,
                          (parseInt(row.attempts, 10) || 0) + 1
                        );
                        setRow(idx, { attempts: String(n) });
                      }}
                      style={styles.stepBtn}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <Switch
                    value={row.completed}
                    onValueChange={(v) => setRow(idx, { completed: v })}
                    trackColor={{
                      true: theme.primary,
                      false: theme.border || '#ccc',
                    }}
                  />
                </View>

                {row.dirty && <View style={styles.dirtyDot} />}
              </View>
            ))}
          </ScrollView>

          <View style={styles.saveBar}>
            <Text style={styles.dirtyText}>
              {dirtyCount > 0
                ? `${dirtyCount} שינויים ממתינים`
                : 'אין שינויים'}
            </Text>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (saving || dirtyCount === 0) && styles.primaryBtnDisabled,
              ]}
              onPress={handleSaveAll}
              disabled={saving || dirtyCount === 0}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>שמור הכל</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    centered: { alignItems: 'center', justifyContent: 'center', padding: 20 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border || '#ddd',
    },
    headerBtn: { width: 36, alignItems: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    searchInput: {
      backgroundColor: theme.surface,
      marginHorizontal: 12,
      marginVertical: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      color: theme.text,
      fontSize: 14,
    },
    participantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: theme.surface,
    },
    participantName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    participantMeta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border || '#eee',
      marginHorizontal: 14,
    },
    selectedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border || '#ddd',
    },
    changeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    changeBtnText: { color: theme.primary, fontSize: 13, fontWeight: '600' },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border || '#eee',
    },
    routeInfo: { width: 90 },
    routeLabel: { fontSize: 14, fontWeight: '700', color: theme.text },
    routeGrade: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    routeControls: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    attemptsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginEnd: 12,
    },
    stepBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { fontSize: 18, color: theme.text, fontWeight: '700' },
    attemptsInput: {
      width: 44,
      textAlign: 'center',
      fontSize: 15,
      color: theme.text,
      marginHorizontal: 4,
    },
    dirtyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
      marginStart: 8,
    },
    saveBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border || '#ddd',
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dirtyText: { fontSize: 13, color: theme.textSecondary },
    primaryBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      minWidth: 100,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginVertical: 20,
      paddingHorizontal: 20,
    },
  });
}
