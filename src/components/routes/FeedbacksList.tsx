/**
 * Renders a list of community feedbacks (star rating, grade, comment, optional video).
 * Shared across all route detail screens.
 */
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import { VideoLinkButton } from '@/components/feedback';
import { CachedAvatar } from '@/components/ui/CachedAvatar';
import { formatDate } from './routeDetailUtils';

export interface FeedbackEntry {
  id: string;
  userId?: string;
  userName?: string;
  userDisplayName?: string;
  userPhotoURL?: string;
  starRating: number;
  suggestedGrade: string;
  comment?: string;
  videoUrl?: string;
  createdAt?: any;
}

export interface FeedbacksListProps {
  feedbacks: FeedbackEntry[];
  loading?: boolean;
  /** Title displayed above the list, e.g. "Community Feedbacks 🧗" */
  title?: string;
  /** Text shown when list is empty */
  emptyText?: string;
  emptySubtext?: string;
  /** Optional: current user UID to filter out own feedback */
  excludeUserId?: string;
  /** Show avatar next to user name (default true) */
  showAvatar?: boolean;
  /** Show date next to feedback (default false) */
  showDate?: boolean;
}

export const FeedbacksList: React.FC<FeedbacksListProps> = ({
  feedbacks,
  loading = false,
  title,
  emptyText,
  emptySubtext,
  excludeUserId,
  showAvatar = true,
  showDate = false,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const filtered = excludeUserId
    ? feedbacks.filter((f) => f.userId !== excludeUserId)
    : feedbacks;

  return (
    <View>
      {title && (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.count}>{filtered.length}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ paddingVertical: 20 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏔️</Text>
          <Text style={styles.emptyText}>
            {emptyText ?? t.routes?.noFeedbacksYet ?? 'No feedbacks yet'}
          </Text>
          {emptySubtext && <Text style={styles.emptySubtext}>{emptySubtext}</Text>}
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((fb) => (
            <View key={fb.id} style={styles.card}>
              {/* User row */}
              <View style={styles.userRow}>
                {showAvatar && (
                  <CachedAvatar
                    photoURL={fb.userPhotoURL}
                    displayName={fb.userDisplayName || fb.userName}
                    size={36}
                    showBorder
                  />
                )}
                <Text style={styles.userName}>
                  {fb.userDisplayName || fb.userName || 'Anonymous'}
                </Text>
                {showDate && fb.createdAt && (
                  <Text style={styles.date}>{formatDate(fb.createdAt)}</Text>
                )}
              </View>

              {/* Stars + Grade */}
              <View style={styles.ratingRow}>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Text key={s} style={[styles.star, s <= fb.starRating && styles.starFilled]}>
                      ★
                    </Text>
                  ))}
                </View>
                <View style={styles.gradeBadge}>
                  <Text style={styles.gradeText}>{fb.suggestedGrade}</Text>
                </View>
              </View>

              {/* Comment */}
              {fb.comment ? <Text style={styles.comment}>{fb.comment}</Text> : null}

              {/* Video */}
              {fb.videoUrl ? <VideoLinkButton url={fb.videoUrl} /> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    count: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    /* Empty state */
    empty: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 6,
    },
    /* List */
    list: {
      gap: 14,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    userName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    date: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    /* Rating */
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stars: {
      flexDirection: 'row',
      gap: 3,
    },
    star: {
      fontSize: 18,
      color: theme.border,
    },
    starFilled: {
      color: theme.starColor,
    },
    gradeBadge: {
      backgroundColor: theme.isDark ? 'rgba(102, 126, 234, 0.2)' : '#EFF6FF',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    gradeText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.primary,
    },
    /* Comment */
    comment: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
  });
