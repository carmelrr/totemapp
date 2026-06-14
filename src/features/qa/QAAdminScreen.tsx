/**
 * @fileoverview Q&A Admin Screen (Shift Manager)
 * @description Answer pending questions and manage the knowledge base.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { auth } from '@/features/data/firebase';
import { usePendingQuestions, useAllAnswered } from './hooks';
import { answerQuestion, editQuestion, setQuestionVisible, deleteQuestion } from './qaService';
import type { Question } from './types';

export function QAAdminScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { items: pending } = usePendingQuestions();
  const { items: answered } = useAllAnswered();
  const myUid = auth.currentUser?.uid || '';
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ניהול שאלות ותשובות</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.sectionTitle}>ממתינות למענה ({pending.length})</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty}>אין שאלות שממתינות למענה.</Text>
        ) : (
          pending.map((q) => <PendingCard key={q.id} q={q} myUid={myUid} theme={theme} />)
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>מאגר הידע ({answered.length})</Text>
        {answered.length === 0 ? (
          <Text style={styles.empty}>מאגר הידע עדיין ריק.</Text>
        ) : (
          answered.map((q) => <KbCard key={q.id} q={q} theme={theme} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PendingCard({ q, myUid, theme }: { q: Question; myUid: string; theme: any }) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const styles = createStyles(theme);

  const handleAnswer = async () => {
    if (!answer.trim()) return;
    setSaving(true);
    try {
      await answerQuestion(q.id, answer, myUid);
    } catch (e) {
      Alert.alert('שגיאה', 'לא ניתן לפרסם תשובה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: theme.warning }]}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{q.title}</Text>
        <View style={styles.authorBadge}>
          <Text style={styles.authorBadgeText}>{q.authorName}</Text>
        </View>
      </View>
      {q.body ? <Text style={styles.body}>{q.body}</Text> : null}
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 8 }]}
        value={answer}
        onChangeText={setAnswer}
        placeholder="כתוב תשובה..."
        placeholderTextColor={theme.textSecondary}
        textAlign="right"
        multiline
      />
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: theme.buttonPrimary, opacity: answer.trim() ? 1 : 0.5 }]}
        onPress={handleAnswer}
        disabled={saving || !answer.trim()}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>פרסם תשובה</Text>}
      </TouchableOpacity>
    </View>
  );
}

function KbCard({ q, theme }: { q: Question; theme: any }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(q.title);
  const [body, setBody] = useState(q.body);
  const [answer, setAnswer] = useState(q.answer || '');
  const [saving, setSaving] = useState(false);
  const styles = createStyles(theme);

  const handleSave = async () => {
    setSaving(true);
    try {
      await editQuestion(q.id, { title, body, answer });
    } catch (e) {
      Alert.alert('שגיאה', 'לא ניתן לשמור');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('מחיקה', `למחוק את "${q.title}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => deleteQuestion(q.id).catch(() => {}) },
    ]);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeaderRow} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        <Text style={styles.cardTitle}>{q.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {!q.visible && (
            <View style={styles.hiddenBadge}>
              <Text style={styles.hiddenBadgeText}>מוסתרת</Text>
            </View>
          )}
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>כותרת</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} textAlign="right" />
          <Text style={styles.label}>פרטי השאלה</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            value={body}
            onChangeText={setBody}
            textAlign="right"
            multiline
          />
          <Text style={styles.label}>תשובה</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={answer}
            onChangeText={setAnswer}
            textAlign="right"
            multiline
          />
          <View style={styles.kbActions}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Switch value={q.visible} onValueChange={(v) => setQuestionVisible(q.id, v).catch(() => {})} />
              <Text style={{ color: theme.text, fontSize: 13 }}>גלויה במאגר</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={[styles.smallBtn, { borderColor: theme.buttonPrimary }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={{ color: theme.buttonPrimary, fontWeight: '600' }}>{saving ? '...' : 'שמירה'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="trash" size={20} color={theme.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 12, writingDirection: 'rtl', textAlign: 'right' },
    empty: { color: theme.textSecondary, marginBottom: 8, writingDirection: 'rtl', textAlign: 'right' },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.text, writingDirection: 'rtl', textAlign: 'right' },
    body: { fontSize: 13, color: theme.textSecondary, marginTop: 4, writingDirection: 'rtl', textAlign: 'right' },
    authorBadge: { backgroundColor: theme.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    authorBadgeText: { fontSize: 11, color: theme.textSecondary, fontWeight: '600' },
    hiddenBadge: { backgroundColor: theme.error + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    hiddenBadgeText: { fontSize: 11, color: theme.error, fontWeight: '600' },
    label: { fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 4, marginTop: 8, textAlign: 'right' },
    input: { backgroundColor: theme.inputBackground, borderRadius: 10, padding: 10, fontSize: 14, color: theme.text, borderWidth: 1, borderColor: theme.border },
    primaryBtn: { borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    kbActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    smallBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  });
