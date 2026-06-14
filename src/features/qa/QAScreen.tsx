/**
 * @fileoverview Q&A Screen (Worker)
 * @description Knowledge base (search + browse) and "my questions", plus ask flow.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { auth } from '@/features/data/firebase';
import { useMyShiftRoles } from '@/features/shifts';
import { useKnowledgeBase, useMyQuestions } from './hooks';
import { askQuestion } from './qaService';
import type { Question } from './types';

function matches(q: Question, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    q.title.toLowerCase().includes(t) ||
    q.body.toLowerCase().includes(t) ||
    (q.answer || '').toLowerCase().includes(t)
  );
}

export function QAScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { userShiftRole } = useMyShiftRoles();
  const { items: kb } = useKnowledgeBase();
  const { items: myQuestions } = useMyQuestions();
  const [tab, setTab] = useState<'kb' | 'mine'>('kb');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [askOpen, setAskOpen] = useState(false);

  const filteredKb = useMemo(() => kb.filter((q) => matches(q, search)), [kb, search]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>שאלות ותשובות</Text>
        <TouchableOpacity onPress={() => setAskOpen(true)}>
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'kb' && styles.tabActive]} onPress={() => setTab('kb')}>
          <Text style={[styles.tabText, tab === 'kb' && styles.tabTextActive]}>מאגר ידע</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'mine' && styles.tabActive]} onPress={() => setTab('mine')}>
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            השאלות שלי ({myQuestions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'kb' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="חיפוש במאגר הידע"
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />
          </View>
          {filteredKb.length === 0 ? (
            <Text style={styles.empty}>{kb.length === 0 ? 'מאגר הידע עדיין ריק.' : 'לא נמצאו תוצאות.'}</Text>
          ) : (
            filteredKb.map((q) => (
              <TouchableOpacity key={q.id} style={styles.card} onPress={() => toggleExpand(q.id)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{q.title}</Text>
                  <Ionicons
                    name={expanded.has(q.id) ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </View>
                {expanded.has(q.id) && (
                  <View style={{ marginTop: 8 }}>
                    {q.body ? <Text style={styles.cardBody}>{q.body}</Text> : null}
                    <Text style={styles.cardAnswer}>{q.answer}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {myQuestions.length === 0 ? (
            <Text style={styles.empty}>עדיין לא שאלת שאלות.</Text>
          ) : (
            myQuestions.map((q) => (
              <TouchableOpacity key={q.id} style={styles.card} onPress={() => toggleExpand(q.id)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{q.title}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: (q.status === 'answered' ? theme.success : theme.warning) + '20' },
                    ]}
                  >
                    <Text style={{ color: q.status === 'answered' ? theme.success : theme.warning, fontSize: 11, fontWeight: '600' }}>
                      {q.status === 'answered' ? 'נענתה' : 'ממתין לתשובה'}
                    </Text>
                  </View>
                </View>
                {expanded.has(q.id) && (
                  <View style={{ marginTop: 8 }}>
                    {q.body ? <Text style={styles.cardBody}>{q.body}</Text> : null}
                    {q.status === 'answered' ? (
                      <Text style={styles.cardAnswer}>{q.answer}</Text>
                    ) : (
                      <Text style={styles.cardBody}>השאלה ממתינה למענה מהמנהל.</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <AskModal
        visible={askOpen}
        knowledgeBase={kb}
        authorUid={auth.currentUser?.uid || ''}
        authorName={userShiftRole?.userName || auth.currentUser?.displayName || 'עובד'}
        onClose={() => setAskOpen(false)}
        onAsked={() => {
          setAskOpen(false);
          setTab('mine');
        }}
      />
    </SafeAreaView>
  );
}

function AskModal({
  visible,
  knowledgeBase,
  authorUid,
  authorName,
  onClose,
  onAsked,
}: {
  visible: boolean;
  knowledgeBase: Question[];
  authorUid: string;
  authorName: string;
  onClose: () => void;
  onAsked: () => void;
}) {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setTitle('');
      setBody('');
    }
  }, [visible]);

  const similar = useMemo(() => {
    const t = title.trim().toLowerCase();
    if (t.length < 2) return [];
    return knowledgeBase.filter((q) => matches(q, t)).slice(0, 3);
  }, [title, knowledgeBase]);

  const handleAsk = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await askQuestion(authorUid, authorName, title, body);
      onAsked();
    } catch (e) {
      Alert.alert('שגיאה', 'לא ניתן לשלוח את השאלה');
    } finally {
      setSaving(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>שאל שאלה</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.label}>כותרת / נושא</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="על מה השאלה?"
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />
            {similar.length > 0 && (
              <View style={styles.similarBox}>
                <Text style={styles.similarTitle}>שאלות דומות במאגר הידע:</Text>
                {similar.map((q) => (
                  <Text key={q.id} style={styles.similarItem}>
                    • {q.title}
                  </Text>
                ))}
              </View>
            )}
            <Text style={styles.label}>פרטים</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={body}
              onChangeText={setBody}
              placeholder="פרטים נוספים (לא חובה)"
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
              multiline
            />
          </ScrollView>
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: theme.buttonPrimary }]}
            onPress={handleAsk}
            disabled={saving || !title.trim()}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>שלח</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    tabs: { flexDirection: 'row', backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: theme.buttonPrimary },
    tabText: { fontSize: 15, color: theme.textSecondary, fontWeight: '600' },
    tabTextActive: { color: theme.buttonPrimary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    searchInput: { flex: 1, paddingVertical: 10, color: theme.text, fontSize: 15 },
    empty: { color: theme.textSecondary, textAlign: 'center', marginTop: 32 },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.text, writingDirection: 'rtl', textAlign: 'right' },
    cardBody: { fontSize: 13, color: theme.textSecondary, marginBottom: 6, writingDirection: 'rtl', textAlign: 'right' },
    cardAnswer: { fontSize: 14, color: theme.text, writingDirection: 'rtl', textAlign: 'right' },
    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text, writingDirection: 'rtl' },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6, marginTop: 12, textAlign: 'right' },
    input: { backgroundColor: theme.inputBackground, borderRadius: 12, padding: 12, fontSize: 15, color: theme.text, borderWidth: 1, borderColor: theme.border },
    similarBox: { backgroundColor: theme.warning + '15', borderRadius: 10, padding: 10, marginTop: 8 },
    similarTitle: { fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 4, textAlign: 'right' },
    similarItem: { fontSize: 13, color: theme.textSecondary, textAlign: 'right' },
    sendBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
