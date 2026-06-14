/**
 * @fileoverview Task Lists Management Screen (Shift Manager)
 * @description CRUD for reusable task checklists attached to shift roles.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useTaskLists } from '../tasksHooks';
import { createTaskList, updateTaskList, deleteTaskList } from '../tasksService';
import type { TaskItem, TaskList } from '../types';

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ==================== Editor Modal ====================

interface EditorProps {
  visible: boolean;
  list: TaskList | null;
  onClose: () => void;
}

function TaskListEditorModal({ visible, list, onClose }: EditorProps) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [items, setItems] = useState<TaskItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(list?.name || '');
      setItems(list ? [...list.items].sort((a, b) => a.order - b.order) : []);
      setNewItem('');
    }
  }, [visible, list]);

  const addItem = () => {
    const title = newItem.trim();
    if (!title) return;
    setItems((prev) => [...prev, { id: genId(), title, order: prev.length }]);
    setNewItem('');
  };

  const editItem = (id: string, title: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title } : i)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('שגיאה', 'יש להזין שם לקבוצה');
      return;
    }
    if (items.length === 0) {
      Alert.alert('שגיאה', 'יש להוסיף לפחות משימה אחת');
      return;
    }
    setSaving(true);
    const ordered = items.map((i, idx) => ({ ...i, title: i.title.trim(), order: idx }));
    try {
      if (list) await updateTaskList(list.id, { name, items: ordered });
      else await createTaskList(name, ordered);
      onClose();
    } catch (e) {
      Alert.alert('שגיאה', 'לא ניתן לשמור את הקבוצה');
    } finally {
      setSaving(false);
    }
  };

  const styles = createEditorStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{list ? 'עריכת קבוצת משימות' : 'קבוצת משימות חדשה'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.label}>שם הקבוצה (פתיחה / סגירה...)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="לדוגמה: סגירה"
              placeholderTextColor={theme.textSecondary}
              textAlign="right"
            />

            <Text style={styles.label}>משימות</Text>
            {items.map((item, index) => (
              <View key={item.id} style={styles.itemRow}>
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Ionicons name="trash-outline" size={20} color={theme.error} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={item.title}
                  onChangeText={(t) => editItem(item.id, t)}
                  textAlign="right"
                />
                <TouchableOpacity disabled={index === items.length - 1} onPress={() => move(index, 1)}>
                  <Ionicons
                    name="arrow-down"
                    size={20}
                    color={index === items.length - 1 ? theme.border : theme.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity disabled={index === 0} onPress={() => move(index, -1)}>
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={index === 0 ? theme.border : theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            ))}
            {items.length === 0 && (
              <Text style={{ color: theme.textSecondary, marginVertical: 8, textAlign: 'right' }}>
                אין עדיין משימות בקבוצה.
              </Text>
            )}

            <View style={styles.addRow}>
              <TouchableOpacity style={styles.addBtn} onPress={addItem}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newItem}
                onChangeText={setNewItem}
                placeholder="משימה חדשה"
                placeholderTextColor={theme.textSecondary}
                textAlign="right"
                onSubmitEditing={addItem}
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.buttonPrimary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>שמור</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ==================== Main Screen ====================

export function TaskListsManagementScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { lists, loading } = useTaskLists();
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<TaskList | null>(null);

  const handleDelete = (list: TaskList) => {
    Alert.alert('מחיקת קבוצה', `למחוק את "${list.name}"?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTaskList(list.id);
          } catch (e) {
            Alert.alert('שגיאה', 'לא ניתן למחוק את הקבוצה');
          }
        },
      },
    ]);
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>קבוצות משימות</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : lists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            אין עדיין קבוצות משימות.{'\n'}צור קבוצה (למשל "פתיחה" / "סגירה") וקשר אותה לתפקיד.
          </Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{item.items.length} משימות</Text>
                  </View>
                </View>
                {item.items.length > 0 && (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.items.map((i) => i.title).join(' · ')}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setEditing(item);
                    setEditorVisible(true);
                  }}
                >
                  <Ionicons name="pencil" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Ionicons name="trash" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditing(null);
          setEditorVisible(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TaskListEditorModal
        visible={editorVisible}
        list={editing}
        onClose={() => {
          setEditorVisible(false);
          setEditing(null);
        }}
      />
    </SafeAreaView>
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
    backBtn: { width: 40 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    cardName: { fontSize: 16, fontWeight: '700', color: theme.text, writingDirection: 'rtl' },
    cardDesc: { fontSize: 13, color: theme.textSecondary, marginTop: 4, writingDirection: 'rtl' },
    countBadge: { backgroundColor: theme.primary + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    countBadgeText: { color: theme.primary, fontSize: 11, fontWeight: '600' },
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
  });

const createEditorStyles = (theme: any) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { fontSize: 18, fontWeight: 'bold', color: theme.text, writingDirection: 'rtl' },
    content: { padding: 16 },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6, marginTop: 12, writingDirection: 'rtl', textAlign: 'right' },
    input: {
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtn: { margin: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
