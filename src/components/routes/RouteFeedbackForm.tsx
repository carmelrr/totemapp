/**
 * Shared feedback form used across all route detail screens.
 * Handles star rating, grade selection, comment, optional video link,
 * and submit/cancel flow.
 * Sections are collapsible – stars & grade are open by default,
 * comment + video link are collapsed.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { VideoLinkInput } from '@/components/feedback';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface RouteFeedbackFormProps {
  /** Current star rating (0-5) */
  starRating: number;
  onStarRatingChange: (v: number) => void;

  /** Currently selected grade string */
  suggestedGrade: string;
  onGradeChange: (v: string) => void;

  /** Array of selectable grade strings */
  grades: string[];

  /** Optional hint like "(allowed range: V3 – V7)" */
  gradeRangeHint?: string;

  /** Comment text */
  comment: string;
  onCommentChange: (v: string) => void;

  /** Comment input placeholder */
  commentPlaceholder?: string;

  /** Video URL – pass undefined to hide the video input entirely */
  videoUrl?: string;
  onVideoUrlChange?: (v: string) => void;

  /** Video link validation state */
  isVideoLinkValid?: boolean;
  onVideoLinkValidChange?: (v: boolean) => void;

  /** Submission handler */
  onSubmit: () => void;
  onCancel: () => void;

  /** Loading indicator */
  isSubmitting: boolean;

  /** Controls whether the submit button says update or submit */
  isUpdate: boolean;

  /** Override the submit button label */
  submitLabel?: string;

  /** Label above star rating */
  starLabel?: string;
  /** Label above grade selector */
  gradeLabel?: string;
  /** Label above comment */
  commentLabel?: string;
}

export const RouteFeedbackForm: React.FC<RouteFeedbackFormProps> = ({
  starRating,
  onStarRatingChange,
  suggestedGrade,
  onGradeChange,
  grades,
  gradeRangeHint,
  comment,
  onCommentChange,
  commentPlaceholder,
  videoUrl,
  onVideoUrlChange,
  isVideoLinkValid,
  onVideoLinkValidChange,
  onSubmit,
  onCancel,
  isSubmitting,
  isUpdate,
  submitLabel,
  starLabel,
  gradeLabel,
  commentLabel,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Collapsible state: stars & grade open, comment collapsed
  const [starsExpanded, setStarsExpanded] = useState(true);
  const [gradeExpanded, setGradeExpanded] = useState(true);
  const [commentExpanded, setCommentExpanded] = useState(false);

  const toggleSection = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter(prev => !prev);
  }, []);

  return (
    <View style={styles.card}>
      {/* Star Rating - collapsible, open by default */}
      <CollapsibleSection
        title={starLabel ?? `${t.routes?.starRating ?? 'Star rating'} ⭐`}
        expanded={starsExpanded}
        onToggle={() => toggleSection(setStarsExpanded)}
        hasValue={starRating > 0}
        valueSummary={starRating > 0 ? '★'.repeat(starRating) : undefined}
        theme={theme}
      >
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => onStarRatingChange(star)}
              style={styles.starButton}
            >
              <Text style={[styles.starText, star <= starRating && styles.starFilled]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
      </CollapsibleSection>

      {/* Grade Selector - collapsible, open by default */}
      <CollapsibleSection
        title={gradeLabel ?? `${t.routes?.suggestedGrade ?? 'Suggested grade'} 📊`}
        expanded={gradeExpanded}
        onToggle={() => toggleSection(setGradeExpanded)}
        hasValue={!!suggestedGrade}
        valueSummary={suggestedGrade || undefined}
        theme={theme}
      >
        {gradeRangeHint ? <Text style={styles.hint}>{gradeRangeHint}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
          {grades.map((grade) => (
            <TouchableOpacity
              key={grade}
              onPress={() => onGradeChange(grade)}
              style={[styles.gradeOption, suggestedGrade === grade && styles.gradeOptionSelected]}
            >
              <Text
                style={[
                  styles.gradeOptionText,
                  suggestedGrade === grade && styles.gradeOptionTextSelected,
                ]}
              >
                {grade}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </CollapsibleSection>

      {/* Comment + Video Link - collapsible, collapsed by default */}
      <CollapsibleSection
        title={commentLabel ?? `${t.routes?.comment ?? 'Comment'} 💬`}
        expanded={commentExpanded}
        onToggle={() => toggleSection(setCommentExpanded)}
        hasValue={!!comment.trim() || !!(videoUrl && videoUrl.trim())}
        theme={theme}
      >
        <TextInput
          style={styles.commentInput}
          placeholder={commentPlaceholder ?? t.spray?.betaTipsExperience ?? 'Beta, tips, experience...'}
          placeholderTextColor={theme.textSecondary}
          value={comment}
          onChangeText={onCommentChange}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Video Link (optional) */}
        {videoUrl !== undefined && onVideoUrlChange && (
          <View style={{ marginTop: 12 }}>
            <VideoLinkInput
              value={videoUrl}
              onChange={onVideoUrlChange}
              onValidationChange={onVideoLinkValidChange}
              disabled={isSubmitting}
            />
          </View>
        )}
      </CollapsibleSection>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>{t.common.cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitDisabled]}
          onPress={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>
              {submitLabel ?? (isUpdate ? t.common.update : t.common.submit)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ── Collapsible Section ─────────────────────────────────── */

interface CollapsibleSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  hasValue?: boolean;
  valueSummary?: string;
  theme: any;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  expanded,
  onToggle,
  hasValue,
  valueSummary,
  theme,
  children,
}) => {
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={{ marginBottom: expanded ? 16 : 4 }}>
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
        }}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={hasValue ? theme.primary : theme.textSecondary}
            />
          </Animated.View>
          <Text style={{
            fontSize: 15,
            fontWeight: '600',
            color: hasValue ? theme.primary : theme.text,
          }}>
            {title}
          </Text>
        </View>
        {!expanded && valueSummary && (
          <Text style={{
            fontSize: 13,
            color: theme.primary,
            fontWeight: '500',
            marginStart: 8,
          }}>
            {valueSummary}
          </Text>
        )}
      </TouchableOpacity>
      {expanded && (
        <View style={{ paddingBottom: 4 }}>
          {children}
        </View>
      )}
    </View>
  );
};

/* ── Styles ───────────────────────────────────────────────── */

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    section: {
      marginBottom: 22,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    /* Stars */
    starsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    starButton: {
      padding: 6,
    },
    starText: {
      fontSize: 40,
      color: theme.border,
    },
    starFilled: {
      color: theme.starColor,
    },
    /* Grades */
    gradeScroll: {
      flexGrow: 0,
    },
    gradeOption: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.surface,
      marginEnd: 10,
      borderWidth: 2,
      borderColor: theme.border,
    },
    gradeOptionSelected: {
      backgroundColor: theme.isDark ? 'rgba(102, 126, 234, 0.2)' : '#EFF6FF',
      borderColor: theme.primary,
    },
    gradeOptionText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    gradeOptionTextSelected: {
      color: theme.primary,
    },
    /* Comment */
    commentInput: {
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: theme.text,
      minHeight: 90,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: theme.border,
    },
    /* Buttons */
    buttons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    submitButton: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.success,
      alignItems: 'center',
    },
    submitDisabled: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#ffffff',
    },
  });
