/**
 * @fileoverview LinkPicker — modal to build a cross-reference (QAStepLink).
 * Pick a target knowledge-base entry, then optionally a specific step within it.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import type { Question, QAStepLink } from '../types';

export function LinkPicker({
  visible,
  questions,
  excludeQuestionId,
  onClose,
  onPick,
}: {
  visible: boolean;
  questions: Question[];
  excludeQuestionId?: string;
  onClose: () => void;
  onPick: (link: QAStepLink) => void;
}) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Question | null>(null);
  const styles = createStyles(theme);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions
      .filter((q) => q.id !== excludeQuestionId)
      .filter((q) => !term || q.title.toLowerCase().includes(term));
  }, [questions, search, excludeQuestionId]);

  const reset = () => {
    setSearch('');
    setSelected(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pick = (link: QAStepLink) => {
    reset();
    onPick(link);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            {selected ? (
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="arrow-forward" size={22} color={theme.text} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 22 }} />
            )}
            <Text style={styles.title}>{selected ? 'בחר שלב' : 'קישור לשאלה אחרת'}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {!selected ? (
            <>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={theme.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="חיפוש שאלה"
                  placeholderTextColor={theme.textSecondary}
                  textAlign="right"
                />
              </View>
              <ScrollView>
                {filtered.length === 0 ? (
                  <Text style={styles.empty}>לא נמצאו שאלות.</Text>
                ) : (
                  filtered.map((q) => (
                    <TouchableOpacity key={q.id} style={styles.row} onPress={() => setSelected(q)}>
                      <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
                      <Text style={styles.rowText}>{q.title}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </>
          ) : (
            <ScrollView>
              <TouchableOpacity
                style={styles.row}
                onPress={() => pick({ questionId: selected.id, stepId: null, label: selected.title })}
              >
                <Ionicons name="link" size={18} color={theme.buttonPrimary} />
                <Text style={[styles.rowText, { fontWeight: '700' }]}>קישור לשאלה כולה</Text>
              </TouchableOpacity>
              {(selected.steps || []).map((s, i) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.row}
                  onPress={() =>
                    pick({
                      questionId: selected.id,
                      stepId: s.id,
                      label: `${selected.title} · שלב ${i + 1}`,
                    })
                  }
                >
                  <Text style={styles.stepBadge}>{i + 1}</Text>
                  <Text style={styles.rowText} numberOfLines={2}>
                    {s.text || `שלב ${i + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: { fontSize: 17, fontWeight: '700', color: theme.text },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 10,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: theme.text, fontSize: 15 },
    empty: { color: theme.textSecondary, textAlign: 'center', marginTop: 24 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowText: { flex: 1, fontSize: 15, color: theme.text, textAlign: 'right' },
    stepBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      textAlign: 'center',
      lineHeight: 24,
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
      backgroundColor: theme.buttonPrimary,
      overflow: 'hidden',
    },
  });

export default LinkPicker;
