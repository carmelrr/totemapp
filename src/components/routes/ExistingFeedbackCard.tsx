/**
 * Displays a user's existing feedback (star rating, grade, comment, video)
 * with an edit button. Shared across all route detail screens.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { VideoLinkButton } from '@/components/feedback';

export interface ExistingFeedbackCardProps {
  starRating: number;
  suggestedGrade: string;
  comment?: string;
  videoUrl?: string;
  onEdit: () => void;
  /** Labels for the rows */
  ratingLabel?: string;
  gradeLabel?: string;
  commentLabel?: string;
  editLabel?: string;
}

export const ExistingFeedbackCard: React.FC<ExistingFeedbackCardProps> = ({
  starRating,
  suggestedGrade,
  comment,
  videoUrl,
  onEdit,
  ratingLabel,
  gradeLabel,
  commentLabel,
  editLabel,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      {/* Star rating row */}
      <View style={styles.row}>
        <Text style={styles.label}>{ratingLabel ?? t.routes?.starRating ?? 'Rating'}:</Text>
        <View style={styles.starsDisplay}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Text key={star} style={[styles.star, star <= starRating && styles.starFilled]}>★</Text>
          ))}
        </View>
      </View>

      {/* Grade row */}
      <View style={styles.row}>
        <Text style={styles.label}>{gradeLabel ?? t.routes?.suggestedGrade ?? 'Grade'}:</Text>
        <Text style={styles.gradeValue}>{suggestedGrade}</Text>
      </View>

      {/* Comment */}
      {comment ? (
        <View style={styles.commentRow}>
          <Text style={styles.label}>{commentLabel ?? t.routes?.comment ?? 'Comment'}:</Text>
          <Text style={styles.commentText}>{comment}</Text>
        </View>
      ) : null}

      {/* Video */}
      {videoUrl ? <VideoLinkButton url={videoUrl} /> : null}

      {/* Edit button */}
      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editText}>✏️ {editLabel ?? t.common.edit}</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4',
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.isDark ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
    },
    commentRow: {
      paddingVertical: 12,
    },
    label: {
      fontSize: 14,
      color: theme.isDark ? '#4ade80' : '#166534',
      fontWeight: '600',
      marginEnd: 12,
      minWidth: 80,
    },
    starsDisplay: {
      flexDirection: 'row',
      gap: 4,
    },
    star: {
      fontSize: 20,
      color: theme.border,
    },
    starFilled: {
      color: theme.starColor,
    },
    gradeValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.isDark ? '#4ade80' : '#15803D',
    },
    commentText: {
      fontSize: 14,
      color: theme.isDark ? '#4ade80' : '#166534',
      marginTop: 4,
      lineHeight: 20,
    },
    editButton: {
      marginTop: 14,
      alignSelf: 'flex-end',
    },
    editText: {
      fontSize: 14,
      color: theme.isDark ? '#4ade80' : '#15803D',
      fontWeight: '700',
    },
  });
