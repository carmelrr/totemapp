/**
 * WallTapeManagementScreen — Admin screen for creating / deleting wall tapes.
 * Accessible from the RoutesMap stack (admin only).
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { useWallTapes } from '../hooks/useWallTapes';
import { addWallTape, deleteWallTape, updateWallTape, autoAssignTapesToRoutes, diagnoseRouteWallTapes, normalizeRouteWallTapes, findOverlappingTapeRanges } from '../services/WallTapeService';

// V-Scale grades for grade range pickers
const GRADES = [
  'VB', 'V0', 'V0+', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10',
  'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18',
];

// A small palette of common tape colors users can pick from quickly
const PRESET_COLORS = [
  '#FF0000', // red
  '#0000FF', // blue
  '#00FF00', // green
  '#FFFF00', // yellow
  '#FFA500', // orange
  '#800080', // purple
  '#FFC0CB', // pink
  '#000000', // black
  '#FFFFFF', // white
  '#00CED1', // cyan
  '#8B4513', // brown
  '#C0C0C0', // gray
];

export default function WallTapeManagementScreen() {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const navigation = useNavigation();
  const { tapes, loading } = useWallTapes();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // New tape form state
  const [nameHe, setNameHe] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [hex, setHex] = useState(PRESET_COLORS[0]);
  const [gradeMin, setGradeMin] = useState('');
  const [gradeMax, setGradeMax] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [normalizing, setNormalizing] = useState(false);

  // Edit existing tape state
  const [editingTapeId, setEditingTapeId] = useState<string | null>(null);
  const [editGradeMin, setEditGradeMin] = useState('');
  const [editGradeMax, setEditGradeMax] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const handleAdd = useCallback(async () => {
    const trimHe = nameHe.trim();
    const trimEn = nameEn.trim();
    if (!trimHe && !trimEn) {
      Alert.alert(t.common?.error || 'Error', t.wallTape?.nameRequired || 'Please enter a tape name');
      return;
    }
    setSaving(true);
    try {
      await addWallTape({
        nameHe: trimHe || trimEn,
        nameEn: trimEn || trimHe,
        hex,
        ...(gradeMin ? { gradeMin } : {}),
        ...(gradeMax ? { gradeMax } : {}),
      });
      setNameHe('');
      setNameEn('');
      setHex(PRESET_COLORS[0]);
      setGradeMin('');
      setGradeMax('');
    } catch (e) {
      console.error('[WallTapeManagement] add error:', e);
      Alert.alert(t.common?.error || 'Error', String(e));
    } finally {
      setSaving(false);
    }
  }, [nameHe, nameEn, hex, t]);

  const handleStartEdit = useCallback((tape: typeof tapes[0]) => {
    setEditingTapeId(tape.id);
    setEditGradeMin(tape.gradeMin || '');
    setEditGradeMax(tape.gradeMax || '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTapeId) return;
    if (!editGradeMin || !editGradeMax) {
      Alert.alert(t.common?.error || 'Error', 'יש לבחור דרגת מינימום ומקסימום');
      return;
    }
    setEditSaving(true);
    try {
      await updateWallTape(editingTapeId, {
        gradeMin: editGradeMin,
        gradeMax: editGradeMax,
      });
      setEditingTapeId(null);
    } catch (e) {
      console.error('[WallTapeManagement] edit error:', e);
      Alert.alert(t.common?.error || 'Error', String(e));
    } finally {
      setEditSaving(false);
    }
  }, [editingTapeId, editGradeMin, editGradeMax, t]);

  const handleDelete = useCallback((tapeId: string, tapeName: string) => {
    Alert.alert(
      t.wallTape?.deleteTape || 'Delete Tape',
      `${t.wallTape?.deleteConfirm || 'Delete'} "${tapeName}"?`,
      [
        { text: t.common?.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.common?.delete || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallTape(tapeId);
            } catch (e) {
              console.error('[WallTapeManagement] delete error:', e);
              Alert.alert(t.common?.error || 'Error', String(e));
            }
          },
        },
      ],
    );
  }, [t]);

  const getContrastText = (bgHex: string): string => {
    const c = bgHex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16) || 0;
    const g = parseInt(c.substr(2, 2), 16) || 0;
    const b = parseInt(c.substr(4, 2), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#FFFFFF';
  };

  const handleAutoAssign = useCallback(async () => {
    const overlaps = findOverlappingTapeRanges(tapes);
    const overlapMsg = overlaps.length > 0
      ? `\n\n⚠️ Overlapping grade ranges detected (${overlaps.length}):\n` +
        overlaps.slice(0, 3).map(({ a, b }) => {
          const an = language === 'he' ? a.nameHe : a.nameEn;
          const bn = language === 'he' ? b.nameHe : b.nameEn;
          return `• ${an} (${a.gradeMin}–${a.gradeMax}) ↔ ${bn} (${b.gradeMin}–${b.gradeMax})`;
        }).join('\n') +
        (overlaps.length > 3 ? `\n... +${overlaps.length - 3} more` : '') +
        '\n\nOnly the first matching tape will be assigned to each route.'
      : '';
    Alert.alert(
      t.wallTape?.autoAssign || 'Auto-Assign Tapes',
      (t.wallTape?.autoAssignConfirm || 'This will assign tapes to all routes that don\'t have a tape yet, based on the grade ranges you defined. Continue?') + overlapMsg,
      [
        { text: t.common?.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.common?.confirm || 'Confirm',
          onPress: async () => {
            setAutoAssigning(true);
            try {
              const result = await autoAssignTapesToRoutes();
              Alert.alert(
                t.wallTape?.autoAssignDone || 'Done',
                `Updated: ${result.updated}\nSkipped: ${result.skipped}\nTotal: ${result.total}`,
              );
            } catch (e: any) {
              console.error('[WallTapeManagement] auto-assign error:', e);
              Alert.alert(t.common?.error || 'Error', `Auto-assign failed:\n${e?.message || String(e)}`);
            } finally {
              setAutoAssigning(false);
            }
          },
        },
      ],
    );
  }, [t, tapes, language]);

  const handleDiagnose = useCallback(async () => {
    setDiagnosing(true);
    try {
      const r = await diagnoseRouteWallTapes();
      const fmtSamples = (arr: Array<{ routeId: string; wallTape: string }>) =>
        arr.length === 0 ? '—' : arr.map((s) => `  • ${s.routeId}: "${s.wallTape}"`).join('\n');
      const msg =
        `Active routes: ${r.totalActive}\n` +
        `With wallTape: ${r.withTape}   Empty: ${r.empty}\n\n` +
        `Matched by id:   ${r.matchedById}\n` +
        `Matched by hex:  ${r.matchedByHex}\n` +
        `Matched by name: ${r.matchedByName}\n` +
        `Unresolved:      ${r.unresolved}\n\n` +
        `Unresolved samples:\n${fmtSamples(r.samples.unresolved)}\n\n` +
        `By-hex samples:\n${fmtSamples(r.samples.matchedByHex)}\n\n` +
        `By-name samples:\n${fmtSamples(r.samples.matchedByName)}`;
      console.log('[WallTapeDiagnostics]', JSON.stringify(r, null, 2));
      Alert.alert('Wall-Tape Diagnostics', msg);
    } catch (e: any) {
      console.error('[WallTapeManagement] diagnose error:', e);
      Alert.alert(t.common?.error || 'Error', `Diagnose failed:\n${e?.message || String(e)}`);
    } finally {
      setDiagnosing(false);
    }
  }, [t]);

  const handleNormalize = useCallback(async () => {
    Alert.alert(
      'Normalize wallTape',
      'This will rewrite legacy wallTape values (hex / name) on routes to the canonical tape id, and auto-assign tapes to routes with empty wallTape based on grade ranges. This action writes to Firestore. Continue?',
      [
        { text: t.common?.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.common?.confirm || 'Confirm',
          onPress: async () => {
            setNormalizing(true);
            try {
              const r = await normalizeRouteWallTapes();
              const msg =
                `Total: ${r.total}\n` +
                `Already canonical: ${r.matchedById}\n` +
                `Rewritten from hex: ${r.rewrittenFromHex}\n` +
                `Rewritten from name: ${r.rewrittenFromName}\n` +
                `Auto-assigned (was empty): ${r.autoAssignedEmpty}\n` +
                `Unresolved (left as-is): ${r.unresolved}`;
              console.log('[WallTapeNormalize]', JSON.stringify(r, null, 2));
              Alert.alert('Normalization Done', msg);
            } catch (e: any) {
              console.error('[WallTapeManagement] normalize error:', e);
              Alert.alert(t.common?.error || 'Error', `Normalize failed:\n${e?.message || String(e)}`);
            } finally {
              setNormalizing(false);
            }
          },
        },
      ],
    );
  }, [t]);

  const renderTapeItem = useCallback(({ item }: { item: typeof tapes[0] }) => {
    const displayName = language === 'he' ? item.nameHe : item.nameEn;
    const gradeRange = item.gradeMin && item.gradeMax ? `${item.gradeMin}–${item.gradeMax}` : '';
    const isEditing = editingTapeId === item.id;

    return (
      <View style={styles.tapeRow}>
        <View style={[styles.tapeColorSwatch, { backgroundColor: item.hex }]}>
          <Text style={{ color: getContrastText(item.hex), fontWeight: '700', fontSize: 12 }}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tapeName}>{displayName}</Text>
          {gradeRange ? (
            <Text style={styles.tapeGradeRange}>{gradeRange}</Text>
          ) : (
            <Text style={[styles.tapeGradeRange, { color: theme.error || '#ef4444' }]}>{'ללא טווח דרגות'}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => isEditing ? setEditingTapeId(null) : handleStartEdit(item)}
          style={styles.deleteButton}
        >
          <Ionicons name={isEditing ? 'close-outline' : 'pencil-outline'} size={20} color={theme.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item.id, displayName)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color={theme.error || '#ef4444'} />
        </TouchableOpacity>
        {isEditing && (
          <View style={styles.editSection}>
            <Text style={styles.label}>{'טווח דרגות'}</Text>
            <View style={styles.gradePickerCol}>
              <Text style={styles.gradePickerLabel}>{t.wallTape?.gradeMin || 'Min'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.gradeChipsRow}>
                  <TouchableOpacity
                    style={[styles.gradeChip, !editGradeMin && styles.gradeChipSelected]}
                    onPress={() => setEditGradeMin('')}
                  >
                    <Text style={[styles.gradeChipText, !editGradeMin && styles.gradeChipTextSelected]}>—</Text>
                  </TouchableOpacity>
                  {GRADES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.gradeChip, editGradeMin === g && styles.gradeChipSelected]}
                      onPress={() => setEditGradeMin(g)}
                    >
                      <Text style={[styles.gradeChipText, editGradeMin === g && styles.gradeChipTextSelected]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.gradePickerCol}>
              <Text style={styles.gradePickerLabel}>{t.wallTape?.gradeMax || 'Max'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.gradeChipsRow}>
                  <TouchableOpacity
                    style={[styles.gradeChip, !editGradeMax && styles.gradeChipSelected]}
                    onPress={() => setEditGradeMax('')}
                  >
                    <Text style={[styles.gradeChipText, !editGradeMax && styles.gradeChipTextSelected]}>—</Text>
                  </TouchableOpacity>
                  {GRADES.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.gradeChip, editGradeMax === g && styles.gradeChipSelected]}
                      onPress={() => setEditGradeMax(g)}
                    >
                      <Text style={[styles.gradeChipText, editGradeMax === g && styles.gradeChipTextSelected]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <TouchableOpacity
              style={[styles.saveEditButton, editSaving && styles.addButtonDisabled]}
              onPress={handleSaveEdit}
              disabled={editSaving}
            >
              {editSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addButtonText}>{'שמור'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [language, styles, theme, handleDelete, handleStartEdit, handleSaveEdit, editingTapeId, editGradeMin, editGradeMax, editSaving, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.wallTape?.manageTapes || 'Manage Wall Tapes'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Existing tapes list */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color={theme.primary} />
      ) : (
        <FlatList
          data={tapes}
          keyExtractor={(item) => item.id}
          renderItem={renderTapeItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t.wallTape?.noTapes || 'No tapes defined yet'}</Text>
          }
        />
      )}

      {/* Add tape form */}
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>{t.wallTape?.addTape || 'Add Tape'}</Text>

        <TextInput
          style={styles.input}
          placeholder={t.wallTape?.tapeNameHe || 'Tape name (Hebrew)'}
          placeholderTextColor={theme.textSecondary}
          value={nameHe}
          onChangeText={setNameHe}
        />
        <TextInput
          style={styles.input}
          placeholder={t.wallTape?.tapeNameEn || 'Tape name (English)'}
          placeholderTextColor={theme.textSecondary}
          value={nameEn}
          onChangeText={setNameEn}
        />

        {/* Color presets */}
        <Text style={styles.label}>{t.wallTape?.tapeColor || 'Tape Color'}</Text>
        <View style={styles.colorGrid}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                hex === c && styles.colorDotSelected,
              ]}
              onPress={() => setHex(c)}
            >
              {hex === c && (
                <Ionicons name="checkmark" size={16} color={getContrastText(c)} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Grade Range */}
        <Text style={styles.label}>{t.wallTape?.gradeRange || 'Grade Range (optional)'}</Text>
        <View style={styles.gradeRangeRow}>
          <View style={styles.gradePickerCol}>
            <Text style={styles.gradePickerLabel}>{t.wallTape?.gradeMin || 'Min'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.gradeChipsRow}>
                <TouchableOpacity
                  style={[styles.gradeChip, !gradeMin && styles.gradeChipSelected]}
                  onPress={() => setGradeMin('')}
                >
                  <Text style={[styles.gradeChipText, !gradeMin && styles.gradeChipTextSelected]}>—</Text>
                </TouchableOpacity>
                {GRADES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeChip, gradeMin === g && styles.gradeChipSelected]}
                    onPress={() => setGradeMin(g)}
                  >
                    <Text style={[styles.gradeChipText, gradeMin === g && styles.gradeChipTextSelected]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={styles.gradePickerCol}>
            <Text style={styles.gradePickerLabel}>{t.wallTape?.gradeMax || 'Max'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.gradeChipsRow}>
                <TouchableOpacity
                  style={[styles.gradeChip, !gradeMax && styles.gradeChipSelected]}
                  onPress={() => setGradeMax('')}
                >
                  <Text style={[styles.gradeChipText, !gradeMax && styles.gradeChipTextSelected]}>—</Text>
                </TouchableOpacity>
                {GRADES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeChip, gradeMax === g && styles.gradeChipSelected]}
                    onPress={() => setGradeMax(g)}
                  >
                    <Text style={[styles.gradeChipText, gradeMax === g && styles.gradeChipTextSelected]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addButton, saving && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addButtonText}>{t.wallTape?.addTape || 'Add Tape'}</Text>
          )}
        </TouchableOpacity>

        {/* Auto-assign button */}
        <TouchableOpacity
          style={[styles.autoAssignButton, autoAssigning && styles.addButtonDisabled]}
          onPress={handleAutoAssign}
          disabled={autoAssigning}
        >
          {autoAssigning ? (
            <ActivityIndicator color={theme.primary} size="small" />
          ) : (
            <Text style={styles.autoAssignText}>{t.wallTape?.autoAssign || 'Auto-Assign Tapes to Routes'}</Text>
          )}
        </TouchableOpacity>

        {/* Diagnose button */}
        <TouchableOpacity
          style={[styles.autoAssignButton, diagnosing && styles.addButtonDisabled]}
          onPress={handleDiagnose}
          disabled={diagnosing}
        >
          {diagnosing ? (
            <ActivityIndicator color={theme.primary} size="small" />
          ) : (
            <Text style={styles.autoAssignText}>Diagnose Route wallTape</Text>
          )}
        </TouchableOpacity>

        {/* Normalize button */}
        <TouchableOpacity
          style={[styles.autoAssignButton, normalizing && styles.addButtonDisabled]}
          onPress={handleNormalize}
          disabled={normalizing}
        >
          {normalizing ? (
            <ActivityIndicator color={theme.primary} size="small" />
          ) : (
            <Text style={styles.autoAssignText}>Normalize wallTape (rewrite legacy values)</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tapeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: 10,
      flexWrap: 'wrap',
    },
    editSection: {
      width: '100%',
      paddingTop: 8,
      gap: 6,
    },
    saveEditButton: {
      backgroundColor: theme.primary,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 4,
    },
    tapeColorSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    tapeName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    tapeGradeRange: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    tapeHex: {
      fontSize: 12,
      color: theme.textSecondary,
      fontFamily: 'monospace',
    },
    deleteButton: {
      padding: 6,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 32,
      fontSize: 14,
      color: theme.textSecondary,
    },
    formContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 16,
      backgroundColor: theme.surface,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      color: theme.text,
      marginBottom: 8,
      backgroundColor: theme.inputBackground || theme.background,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
      marginTop: 4,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    colorDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorDotSelected: {
      borderColor: theme.primary,
    },
    addButton: {
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    addButtonDisabled: {
      opacity: 0.5,
    },
    addButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
    autoAssignButton: {
      marginTop: 10,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: theme.primary,
    },
    autoAssignText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    gradeRangeRow: {
      gap: 8,
      marginBottom: 12,
    },
    gradePickerCol: {
      gap: 4,
    },
    gradePickerLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    gradeChipsRow: {
      flexDirection: 'row',
      gap: 4,
    },
    gradeChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    gradeChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    gradeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    gradeChipTextSelected: {
      color: '#fff',
    },
  });
