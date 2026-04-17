/**
 * @fileoverview Result edit history modal.
 * @description Shows the audit trail for a single participant's results
 * (who entered/edited each route, when, and what changed). Fetches once on
 * open from `results/{userId}/history` ordered by `editedAt` desc.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/features/theme';
import { useLanguage } from '@/features/language';
import { ResultsService } from '@/features/competitions/services/ResultsService';

interface HistoryEntry {
  id: string;
  routeNumber?: number;
  routeId?: string;
  action: 'create' | 'update' | 'delete' | 'remove' | string;
  previous?: any;
  next?: any;
  editedBy?: string;
  editedAt?: any;
  version?: number;
  isSelfReport?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  competitionId: string;
  participantId: string;
  participantName?: string;
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleString('he-IL');
  } catch {
    return '';
  }
}

function summarizeChange(entry: HistoryEntry): string {
  const prev = entry.previous || {};
  const next = entry.next || {};
  if (entry.action === 'create') {
    const attempts = next.attempts ?? '?';
    const grade = next.grade || '';
    const completed = next.completed ? '✓' : '✗';
    return `נוסף: ${completed} ${grade} (${attempts} ניסיונות)`;
  }
  if (entry.action === 'delete' || entry.action === 'remove') {
    const attempts = prev.attempts ?? '?';
    const grade = prev.grade || '';
    return `נמחק: ${grade} (${attempts} ניסיונות)`;
  }
  const parts: string[] = [];
  if (prev.completed !== next.completed) {
    parts.push(
      `סיום: ${prev.completed ? '✓' : '✗'} → ${next.completed ? '✓' : '✗'}`
    );
  }
  if (prev.attempts !== next.attempts) {
    parts.push(`ניסיונות: ${prev.attempts ?? '-'} → ${next.attempts ?? '-'}`);
  }
  if (prev.grade !== next.grade) {
    parts.push(`דירוג: ${prev.grade || '-'} → ${next.grade || '-'}`);
  }
  if (parts.length === 0) return 'עודכן';
  return parts.join(' · ');
}

export function ResultHistoryModal({
  visible,
  onClose,
  competitionId,
  participantId,
  participantName,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ResultsService.getResultHistory(
          competitionId,
          participantId
        );
        if (!cancelled) setItems(res as HistoryEntry[]);
      } catch (e) {
        console.warn('[ResultHistoryModal] failed', e);
        if (!cancelled) setError('טעינת ההיסטוריה נכשלה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, competitionId, participantId]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const actionColor =
      item.action === 'create'
        ? theme.success || '#2ecc71'
        : item.action === 'delete' || item.action === 'remove'
        ? theme.error || '#e74c3c'
        : theme.primary;
    return (
      <View style={styles.row}>
        <View style={[styles.actionDot, { backgroundColor: actionColor }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.rowHeader}>
            <Text style={styles.routeLabel}>
              {item.routeNumber != null ? `מסלול #${item.routeNumber}` : '—'}
              {item.version != null ? `  v${item.version}` : ''}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(item.editedAt)}</Text>
          </View>
          <Text style={styles.changeText}>{summarizeChange(item)}</Text>
          <Text style={styles.metaText}>
            {item.isSelfReport ? 'דיווח עצמי' : 'שופט'}
            {item.editedBy ? ` · ${item.editedBy.slice(0, 6)}` : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              היסטוריית עריכה{participantName ? ` — ${participantName}` : ''}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>סגור</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>אין עריכות להצגה</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingVertical: 8 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '80%',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border || '#ccc',
      paddingBottom: 10,
      marginBottom: 6,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      flex: 1,
      marginEnd: 8,
    },
    closeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    closeText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border || '#eee',
    },
    actionDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 6,
      marginEnd: 10,
    },
    rowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    routeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    timestamp: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    changeText: {
      fontSize: 13,
      color: theme.text,
    },
    metaText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    centered: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
  });
}

export default ResultHistoryModal;
