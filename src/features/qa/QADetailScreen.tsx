/**
 * @fileoverview Q&A Detail Screen
 * @description Renders a single knowledge-base entry: question + media, then either ordered
 * steps (each with media + cross-link chips) or the legacy plain answer. An incoming
 * `focusStepId` route param scrolls to / highlights that step (used by cross-links).
 */

import React, { useEffect, useRef, useState } from 'react';
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
import { useQuestion } from './hooks';
import { MediaGallery } from './components/MediaGallery';
import type { QAStep, QAStepLink } from './types';

export function QADetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const questionId: string = route.params?.questionId;
  const focusStepId: string | undefined = route.params?.focusStepId;
  const { item, loading } = useQuestion(questionId);
  const styles = createStyles(theme);

  const scrollRef = useRef<ScrollView>(null);
  const stepOffsets = useRef<Record<string, number>>({});
  const [didFocus, setDidFocus] = useState(false);

  // Scroll to the focused step once content + offsets are available.
  useEffect(() => {
    if (didFocus || !focusStepId || loading) return;
    const y = stepOffsets.current[focusStepId];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      setDidFocus(true);
    }
  }, [focusStepId, loading, didFocus, item]);

  const openLink = (link: QAStepLink) => {
    navigation.push('QADetail', { questionId: link.questionId, focusStepId: link.stepId ?? undefined });
  };

  const renderStep = (step: QAStep, index: number) => {
    const focused = step.id === focusStepId;
    return (
      <View
        key={step.id}
        onLayout={(e) => {
          stepOffsets.current[step.id] = e.nativeEvent.layout.y;
        }}
        style={[styles.step, focused && styles.stepFocused]}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepBadge}>{index + 1}</Text>
          {step.text ? <Text style={styles.stepText}>{step.text}</Text> : null}
        </View>
        <MediaGallery media={step.media} />
        {step.links.length > 0 && (
          <View style={styles.links}>
            {step.links.map((link, i) => (
              <TouchableOpacity key={i} style={styles.linkChip} onPress={() => openLink(link)}>
                <Ionicons name="link" size={14} color={theme.buttonPrimary} />
                <Text style={styles.linkChipText} numberOfLines={1}>
                  {link.label || 'מעבר לשאלה מקושרת'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const hasSteps = !!item?.steps && item.steps.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item?.title || 'שאלה ותשובה'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.buttonPrimary} />
      ) : !item ? (
        <Text style={styles.empty}>השאלה לא נמצאה.</Text>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          <MediaGallery media={item.media} />

          {hasSteps ? (
            <View style={{ marginTop: 12 }}>{item.steps!.map(renderStep)}</View>
          ) : item.answer ? (
            <Text style={styles.answer}>{item.answer}</Text>
          ) : (
            <Text style={styles.empty}>אין תשובה עדיין.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
    headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: theme.text, textAlign: 'right', writingDirection: 'rtl' },
    body: { fontSize: 14, color: theme.textSecondary, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
    answer: { fontSize: 15, color: theme.text, marginTop: 12, textAlign: 'right', writingDirection: 'rtl' },
    empty: { color: theme.textSecondary, textAlign: 'center', marginTop: 32 },
    step: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stepFocused: { borderColor: theme.buttonPrimary, borderWidth: 2 },
    stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    stepBadge: {
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
    stepText: { flex: 1, fontSize: 15, color: theme.text, textAlign: 'right', writingDirection: 'rtl' },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
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
    linkChipText: { color: theme.buttonPrimary, fontSize: 13, fontWeight: '600' },
  });

export default QADetailScreen;
