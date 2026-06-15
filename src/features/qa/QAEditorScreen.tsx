/**
 * @fileoverview Q&A Editor Screen (Shift Manager / Admin)
 * @description Authoring UI for knowledge-base entries: folder assignment, free-text answer,
 * ordered steps (each with media + cross-links), and question-level media. Used both to
 * answer a pending worker question and to create/edit a KB entry from scratch.
 */

import React, { useEffect, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '@/features/theme/ThemeContext';
import { auth } from '@/features/data/firebase';
import { validateVideoLink, getPlatformIcon } from '@/utils/linkValidation';
import { useFolders, useAllAnswered, useQuestion } from './hooks';
import { createKbEntry, saveQuestionContent, createFolder } from './qaService';
import { uploadQAMedia } from './qaMediaService';
import { LinkPicker } from './components/LinkPicker';
import type { QAMedia, QAStep, QAStepLink, QAMediaKind } from './types';

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function QAEditorScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const questionId: string | undefined = route.params?.questionId;
  const isNew = !questionId;
  const { item } = useQuestion(questionId);
  const { items: folders } = useFolders();
  const { items: kbEntries } = useAllAnswered();
  const styles = createStyles(theme);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [answer, setAnswer] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [media, setMedia] = useState<QAMedia[]>([]);
  const [steps, setSteps] = useState<QAStep[]>([]);
  const [visible, setVisible] = useState(true);
  const [wasOpen, setWasOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [populated, setPopulated] = useState(false);
  const [linkStepIndex, setLinkStepIndex] = useState<number | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Populate from the existing question once it loads.
  useEffect(() => {
    if (populated || !item) return;
    setTitle(item.title);
    setBody(item.body);
    setAnswer(item.answer || '');
    setFolderId(item.folderId ?? null);
    setMedia(item.media || []);
    setSteps(item.steps || []);
    setVisible(item.status === 'open' ? true : item.visible);
    setWasOpen(item.status === 'open');
    setPopulated(true);
  }, [item, populated]);

  const ownerUid = auth.currentUser?.uid || 'shared';

  // ---- Step helpers ----
  const addStep = () => setSteps((s) => [...s, { id: genId(), text: '', media: [], links: [] }]);
  const updateStep = (i: number, patch: Partial<QAStep>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const onPickLink = (link: QAStepLink) => {
    if (linkStepIndex === null) return;
    const i = linkStepIndex;
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, links: [...st.links, link] } : st)));
    setLinkStepIndex(null);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const id = await createFolder(name, ownerUid, folders.length);
      setFolderId(id);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן ליצור תיקייה');
    } finally {
      setNewFolderOpen(false);
      setNewFolderName('');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('חסר', 'יש להזין כותרת');
      return;
    }
    setSaving(true);
    try {
      const content = { title, body, answer, folderId, media, steps, visible };
      if (isNew) {
        await createKbEntry(content, {
          uid: ownerUid,
          name: auth.currentUser?.displayName || 'צוות',
        });
      } else {
        await saveQuestionContent(
          questionId!,
          content,
          wasOpen ? { markAnswered: true, answeredBy: ownerUid } : undefined,
        );
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('שגיאה', 'לא ניתן לשמור');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'שאלה ותשובה חדשה' : 'עריכת שאלה ותשובה'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={26} color="#fff" />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>כותרת / נושא</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} textAlign="right" placeholder="על מה השאלה?" placeholderTextColor={theme.textSecondary} />

        <Text style={styles.label}>פרטי השאלה (לא חובה)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={body}
          onChangeText={setBody}
          textAlign="right"
          multiline
          placeholder="הקשר / פרטים"
          placeholderTextColor={theme.textSecondary}
        />

        {/* Folder picker */}
        <Text style={styles.label}>תיקייה</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FolderChip label="ללא" active={!folderId} onPress={() => setFolderId(null)} theme={theme} />
          {folders.map((f) => (
            <FolderChip key={f.id} label={f.name} active={folderId === f.id} onPress={() => setFolderId(f.id)} theme={theme} />
          ))}
          <TouchableOpacity style={styles.newFolderChip} onPress={() => setNewFolderOpen(true)}>
            <Ionicons name="add" size={16} color={theme.buttonPrimary} />
            <Text style={{ color: theme.buttonPrimary, fontWeight: '600' }}>תיקייה</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Question-level media */}
        <Text style={styles.label}>מדיה לשאלה</Text>
        <MediaEditor media={media} onChange={setMedia} ownerUid={ownerUid} theme={theme} />

        {/* Free-text answer */}
        <Text style={styles.label}>תשובה (טקסט חופשי)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={answer}
          onChangeText={setAnswer}
          textAlign="right"
          multiline
          placeholder="תשובה כללית (אם אין שלבים)"
          placeholderTextColor={theme.textSecondary}
        />

        {/* Steps */}
        <View style={styles.stepsHeader}>
          <Text style={[styles.label, { marginTop: 0 }]}>שלבים</Text>
          <TouchableOpacity style={styles.addStepBtn} onPress={addStep}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addStepText}>הוסף שלב</Text>
          </TouchableOpacity>
        </View>

        {steps.map((step, i) => (
          <View key={step.id} style={styles.stepCard}>
            <View style={styles.stepCardHeader}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => moveStep(i, -1)} disabled={i === 0}>
                  <Ionicons name="arrow-up" size={20} color={i === 0 ? theme.border : theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveStep(i, 1)} disabled={i === steps.length - 1}>
                  <Ionicons name="arrow-down" size={20} color={i === steps.length - 1 ? theme.border : theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeStep(i)}>
                  <Ionicons name="trash" size={20} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={step.text}
              onChangeText={(t) => updateStep(i, { text: t })}
              textAlign="right"
              multiline
              placeholder={`טקסט לשלב ${i + 1}`}
              placeholderTextColor={theme.textSecondary}
            />
            <MediaEditor
              media={step.media}
              onChange={(m) => updateStep(i, { media: m })}
              ownerUid={ownerUid}
              theme={theme}
            />
            {/* Step links */}
            {step.links.length > 0 && (
              <View style={styles.linkRow}>
                {step.links.map((l, li) => (
                  <View key={li} style={styles.linkChip}>
                    <Text style={styles.linkChipText} numberOfLines={1}>
                      {l.label || 'קישור'}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        updateStep(i, { links: step.links.filter((_, idx) => idx !== li) })
                      }
                    >
                      <Ionicons name="close" size={14} color={theme.buttonPrimary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.addLinkBtn} onPress={() => setLinkStepIndex(i)}>
              <Ionicons name="link" size={16} color={theme.buttonPrimary} />
              <Text style={{ color: theme.buttonPrimary, fontWeight: '600' }}>קשר לשאלה אחרת</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Visibility */}
        <View style={styles.visibleRow}>
          <Switch value={visible} onValueChange={setVisible} />
          <Text style={{ color: theme.text, fontSize: 14 }}>גלויה במאגר הידע</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.buttonPrimary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>שמירה</Text>}
        </TouchableOpacity>
      </ScrollView>

      <LinkPicker
        visible={linkStepIndex !== null}
        questions={kbEntries}
        excludeQuestionId={questionId}
        onClose={() => setLinkStepIndex(null)}
        onPick={onPickLink}
      />

      {/* New folder modal */}
      <Modal visible={newFolderOpen} transparent animationType="fade" onRequestClose={() => setNewFolderOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>תיקייה חדשה</Text>
            <TextInput
              style={styles.input}
              value={newFolderName}
              onChangeText={setNewFolderName}
              textAlign="right"
              placeholder="שם התיקייה"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setNewFolderOpen(false)}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateFolder}>
                <Text style={{ color: theme.buttonPrimary, fontWeight: '700' }}>צור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FolderChip({ label, active, onPress, theme }: { label: string; active: boolean; onPress: () => void; theme: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: active ? theme.buttonPrimary : theme.border,
        backgroundColor: active ? theme.buttonPrimary + '20' : 'transparent',
      }}
    >
      <Text style={{ color: active ? theme.buttonPrimary : theme.text, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function MediaEditor({
  media,
  onChange,
  ownerUid,
  theme,
}: {
  media: QAMedia[];
  onChange: (m: QAMedia[]) => void;
  ownerUid: string;
  theme: any;
}) {
  const styles = createStyles(theme);
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const pick = async (kind: QAMediaKind) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'video' ? ['videos'] : ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    setBusy(true);
    try {
      const url = await uploadQAMedia(result.assets[0].uri, kind, ownerUid);
      onChange([...media, { id: genId(), kind, source: 'upload', url }]);
    } catch {
      Alert.alert('שגיאה', 'העלאת הקובץ נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const addLink = () => {
    const v = validateVideoLink(linkUrl);
    if (!v.isValid) {
      Alert.alert('קישור לא תקין', v.error || 'יש להזין קישור תקין');
      return;
    }
    onChange([...media, { id: genId(), kind: 'video', source: 'link', url: linkUrl.trim() }]);
    setLinkUrl('');
  };

  const remove = (id: string) => onChange(media.filter((m) => m.id !== id));

  return (
    <View>
      {media.length > 0 && (
        <View style={styles.thumbRow}>
          {media.map((m) => (
            <View key={m.id} style={styles.thumb}>
              {m.kind === 'image' ? (
                <ExpoImage source={{ uri: m.url }} style={styles.thumbImg} contentFit="cover" />
              ) : (
                <View style={[styles.thumbImg, styles.thumbVideo]}>
                  <Text style={{ fontSize: 22 }}>
                    {m.source === 'link' ? getPlatformIcon(m.url) : '🎬'}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.thumbRemove} onPress={() => remove(m.id)}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.mediaBtns}>
        <TouchableOpacity style={styles.mediaBtn} onPress={() => pick('image')} disabled={busy}>
          <Ionicons name="image" size={18} color={theme.buttonPrimary} />
          <Text style={styles.mediaBtnText}>תמונה</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaBtn} onPress={() => pick('video')} disabled={busy}>
          <Ionicons name="videocam" size={18} color={theme.buttonPrimary} />
          <Text style={styles.mediaBtnText}>וידאו</Text>
        </TouchableOpacity>
        {busy && <ActivityIndicator color={theme.buttonPrimary} />}
      </View>
      <View style={styles.linkInputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={linkUrl}
          onChangeText={setLinkUrl}
          textAlign="right"
          placeholder="הדבק קישור וידאו (YouTube/Vimeo)"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.linkAddBtn} onPress={addLink}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
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
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 16, marginBottom: 6, textAlign: 'right' },
    input: {
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    multiline: { height: 90, textAlignVertical: 'top' },
    newFolderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.buttonPrimary,
      borderStyle: 'dashed',
    },
    thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
    thumbImg: { width: 72, height: 72, borderRadius: 10, backgroundColor: theme.border },
    thumbVideo: { alignItems: 'center', justifyContent: 'center' },
    thumbRemove: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 10,
      padding: 2,
    },
    mediaBtns: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    mediaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.buttonPrimary,
    },
    mediaBtnText: { color: theme.buttonPrimary, fontWeight: '600' },
    linkInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    linkAddBtn: { backgroundColor: theme.buttonPrimary, borderRadius: 10, padding: 10 },
    stepsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    addStepBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.buttonPrimary,
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    addStepText: { color: '#fff', fontWeight: '700' },
    stepCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stepCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      textAlign: 'center',
      lineHeight: 26,
      fontSize: 14,
      fontWeight: '800',
      color: '#fff',
      backgroundColor: theme.buttonPrimary,
      overflow: 'hidden',
    },
    linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    linkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.buttonPrimary,
      maxWidth: '100%',
    },
    linkChipText: { color: theme.buttonPrimary, fontSize: 13, fontWeight: '600', maxWidth: 180 },
    addLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    visibleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
    saveBtn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, marginBottom: 32 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: theme.surface, borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 12, textAlign: 'right' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 16 },
  });

export default QAEditorScreen;
