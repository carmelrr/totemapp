/**
 * @fileoverview Q&A Admin Screen (Shift Manager)
 * @description Answer pending questions, manage the knowledge base, and manage folders.
 * Answering/editing opens the full QAEditor; folders are managed in an inline modal.
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
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { auth } from '@/features/data/firebase';
import { usePendingQuestions, useAllAnswered, useFolders } from './hooks';
import {
  setQuestionVisible,
  deleteQuestion,
  createFolder,
  renameFolder,
  deleteFolder,
  reorderFolders,
} from './qaService';
import type { Question, QAFolder } from './types';

export function QAAdminScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { items: pending } = usePendingQuestions();
  const { items: answered } = useAllAnswered();
  const { items: folders } = useFolders();
  const [foldersOpen, setFoldersOpen] = useState(false);
  const styles = createStyles(theme);

  const folderName = (id?: string | null) => folders.find((f) => f.id === id)?.name;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ניהול שאלות ותשובות</Text>
        <TouchableOpacity onPress={() => navigation.navigate('QAEditor', {})}>
          <Ionicons name="add-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity style={styles.foldersBtn} onPress={() => setFoldersOpen(true)} activeOpacity={0.7}>
          <Ionicons name="folder-outline" size={18} color={theme.buttonPrimary} />
          <Text style={styles.foldersBtnText}>ניהול תיקיות ({folders.length})</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>ממתינות למענה ({pending.length})</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty}>אין שאלות שממתינות למענה.</Text>
        ) : (
          pending.map((q) => (
            <PendingCard
              key={q.id}
              q={q}
              theme={theme}
              onAnswer={() => navigation.navigate('QAEditor', { questionId: q.id })}
            />
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>מאגר הידע ({answered.length})</Text>
        {answered.length === 0 ? (
          <Text style={styles.empty}>מאגר הידע עדיין ריק.</Text>
        ) : (
          answered.map((q) => (
            <KbCard
              key={q.id}
              q={q}
              theme={theme}
              folderName={folderName(q.folderId)}
              onEdit={() => navigation.navigate('QAEditor', { questionId: q.id })}
            />
          ))
        )}
      </ScrollView>

      <FolderManagerModal
        visible={foldersOpen}
        folders={folders}
        theme={theme}
        onClose={() => setFoldersOpen(false)}
      />
    </SafeAreaView>
  );
}

function PendingCard({ q, theme, onAnswer }: { q: Question; theme: any; onAnswer: () => void }) {
  const styles = createStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftWidth: 3, borderLeftColor: theme.warning }]}
      onPress={onAnswer}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{q.title}</Text>
        <View style={styles.authorBadge}>
          <Text style={styles.authorBadgeText}>{q.authorName}</Text>
        </View>
      </View>
      {q.body ? <Text style={styles.body}>{q.body}</Text> : null}
      <View style={[styles.primaryBtn, { backgroundColor: theme.buttonPrimary }]}>
        <Text style={styles.primaryBtnText}>ענה</Text>
      </View>
    </TouchableOpacity>
  );
}

function KbCard({
  q,
  theme,
  folderName,
  onEdit,
}: {
  q: Question;
  theme: any;
  folderName?: string;
  onEdit: () => void;
}) {
  const styles = createStyles(theme);

  const handleDelete = () => {
    Alert.alert('מחיקה', `למחוק את "${q.title}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => deleteQuestion(q.id).catch(() => {}) },
    ]);
  };

  const stepCount = q.steps?.length || 0;
  const mediaCount = q.media?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onEdit} activeOpacity={0.7}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{q.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {!q.visible && (
            <View style={styles.hiddenBadge}>
              <Text style={styles.hiddenBadgeText}>מוסתרת</Text>
            </View>
          )}
          <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
        </View>
      </View>
      <View style={styles.metaRow}>
        {folderName ? (
          <View style={styles.metaChip}>
            <Ionicons name="folder-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.metaChipText}>{folderName}</Text>
          </View>
        ) : null}
        {stepCount > 0 && (
          <View style={styles.metaChip}>
            <Ionicons name="list-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.metaChipText}>{stepCount} שלבים</Text>
          </View>
        )}
        {mediaCount > 0 && (
          <View style={styles.metaChip}>
            <Ionicons name="image-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.metaChipText}>{mediaCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.kbActions}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Switch value={q.visible} onValueChange={(v) => setQuestionVisible(q.id, v).catch(() => {})} />
          <Text style={{ color: theme.text, fontSize: 13 }}>גלויה במאגר</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} hitSlop={8}>
          <Ionicons name="trash" size={20} color={theme.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function FolderManagerModal({
  visible,
  folders,
  theme,
  onClose,
}: {
  visible: boolean;
  folders: QAFolder[];
  theme: any;
  onClose: () => void;
}) {
  const styles = createStyles(theme);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const myUid = auth.currentUser?.uid || 'shared';

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createFolder(name, myUid, folders.length);
      setNewName('');
    } catch {
      Alert.alert('שגיאה', 'לא ניתן ליצור תיקייה');
    } finally {
      setBusy(false);
    }
  };

  const startRename = (f: QAFolder) => {
    setEditingId(f.id);
    setEditingName(f.name);
  };

  const commitRename = () => {
    const name = editingName.trim();
    if (editingId && name) renameFolder(editingId, name).catch(() => {});
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = (f: QAFolder) => {
    Alert.alert('מחיקת תיקייה', `למחוק את "${f.name}"? השאלות יישארו ללא תיקייה.`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => deleteFolder(f.id).catch(() => {}) },
    ]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= folders.length) return;
    const ordered = folders.map((f) => f.id);
    [ordered[index], ordered[j]] = [ordered[j], ordered[index]];
    reorderFolders(ordered).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.modalTitle}>ניהול תיקיות</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.newFolderRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="שם תיקייה חדשה"
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />
            <TouchableOpacity
              style={[styles.addFolderBtn, { backgroundColor: theme.buttonPrimary, opacity: newName.trim() ? 1 : 0.5 }]}
              onPress={handleCreate}
              disabled={busy || !newName.trim()}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="add" size={22} color="#fff" />}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ marginTop: 12 }}>
            {folders.length === 0 ? (
              <Text style={styles.empty}>אין תיקיות עדיין.</Text>
            ) : (
              folders.map((f, i) => (
                <View key={f.id} style={styles.folderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6}>
                      <Ionicons name="arrow-up" size={20} color={i === 0 ? theme.border : theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => move(i, 1)} disabled={i === folders.length - 1} hitSlop={6}>
                      <Ionicons
                        name="arrow-down"
                        size={20}
                        color={i === folders.length - 1 ? theme.border : theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  {editingId === f.id ? (
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editingName}
                      onChangeText={setEditingName}
                      onSubmitEditing={commitRename}
                      onBlur={commitRename}
                      textAlign="right"
                      autoFocus
                    />
                  ) : (
                    <Text style={styles.folderRowName}>{f.name}</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    {editingId === f.id ? (
                      <TouchableOpacity onPress={commitRename} hitSlop={6}>
                        <Ionicons name="checkmark" size={20} color={theme.buttonPrimary} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => startRename(f)} hitSlop={6}>
                        <Ionicons name="pencil" size={18} color={theme.buttonPrimary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDelete(f)} hitSlop={6}>
                      <Ionicons name="trash" size={18} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
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
    foldersBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.buttonPrimary,
      borderRadius: 12,
      paddingVertical: 10,
      marginBottom: 20,
    },
    foldersBtnText: { color: theme.buttonPrimary, fontWeight: '700', fontSize: 14 },
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
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    metaChipText: { fontSize: 11, color: theme.textSecondary, fontWeight: '600' },
    input: { backgroundColor: theme.inputBackground, borderRadius: 10, padding: 10, fontSize: 14, color: theme.text, borderWidth: 1, borderColor: theme.border },
    primaryBtn: { borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    kbActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text, writingDirection: 'rtl', textAlign: 'right' },
    newFolderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
    addFolderBtn: { borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
    folderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    folderRowName: { flex: 1, fontSize: 15, color: theme.text, textAlign: 'right', writingDirection: 'rtl' },
  });
