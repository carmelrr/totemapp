/**
 * @fileoverview RouteStatsSection - סטטיסטיקות מסלול מפורטות
 * Displays: climbed by count, grade vote distribution chart, star rating breakdown
 * Used in route detail screens: WallMap, SprayWall, Community Routes
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';

// V-Scale grades for display order
const V_GRADES = ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

interface FeedbackItem {
  starRating: number;
  suggestedGrade?: string;
}

interface RouteStatsSectionProps {
  /** Number of people who climbed/topped the route */
  climbedCount: number;
  /** All feedbacks for computing grade votes & star distribution */
  feedbacks: FeedbackItem[];
  /** Average star rating (pre-calculated) */
  averageStarRating: number;
  /** The original grade set by the route builder */
  originalGrade?: string;
  /** The calculated community grade */
  calculatedGrade?: string | null;
}

export const RouteStatsSection: React.FC<RouteStatsSectionProps> = ({
  climbedCount,
  feedbacks,
  averageStarRating,
  originalGrade,
  calculatedGrade,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // --- Grade votes distribution ---
  const gradeVotes = useMemo(() => {
    const votes: Record<string, number> = {};
    feedbacks.forEach((fb) => {
      if (fb.suggestedGrade) {
        votes[fb.suggestedGrade] = (votes[fb.suggestedGrade] || 0) + 1;
      }
    });
    return votes;
  }, [feedbacks]);

  // Get only grades with votes, ordered by V_GRADES
  const gradeVoteEntries = useMemo(() => {
    return V_GRADES.filter((g) => gradeVotes[g] > 0).map((g) => ({
      grade: g,
      count: gradeVotes[g],
    }));
  }, [gradeVotes]);

  const maxGradeVoteCount = useMemo(() => {
    if (gradeVoteEntries.length === 0) return 1;
    return Math.max(...gradeVoteEntries.map((e) => e.count));
  }, [gradeVoteEntries]);

  // --- Star rating distribution ---
  const starDistribution = useMemo(() => {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach((fb) => {
      if (fb.starRating >= 1 && fb.starRating <= 5) {
        dist[fb.starRating]++;
      }
    });
    return dist;
  }, [feedbacks]);

  const totalStarVotes = useMemo(() => {
    return Object.values(starDistribution).reduce((s, c) => s + c, 0);
  }, [starDistribution]);

  const maxStarCount = useMemo(() => {
    if (totalStarVotes === 0) return 1;
    return Math.max(...Object.values(starDistribution));
  }, [starDistribution, totalStarVotes]);

  return (
    <View style={styles.container}>
      {/* ── Climbed By Section ── */}
      <View style={styles.climbedByRow}>
        <Ionicons name="checkmark-done" size={22} color={theme.success || '#10B981'} />
        <Text style={styles.climbedByText}>
          {t.routeStats?.climbedBy || 'טופס ע"י'}{' '}
          <Text style={styles.climbedByCount}>{climbedCount}</Text>{' '}
          {t.routeStats?.people || 'אנשים'}
        </Text>
      </View>

      {/* ── Grade Votes Section ── */}
      {gradeVoteEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t.routeStats?.gradeVotes || 'הצבעות דירוג'}
          </Text>

          <View style={styles.gradeChartContainer}>
            {/* Bars */}
            <View style={styles.gradeBarsRow}>
              {gradeVoteEntries.map((entry) => {
                const barHeight = Math.max(
                  20,
                  (entry.count / maxGradeVoteCount) * 120
                );
                return (
                  <View key={entry.grade} style={styles.gradeBarWrapper}>
                    <Text style={styles.gradeBarCount}>{entry.count}</Text>
                    <View
                      style={[
                        styles.gradeBar,
                        {
                          height: barHeight,
                          backgroundColor: theme.primary || '#E91E63',
                        },
                      ]}
                    />
                    <Text style={styles.gradeBarLabel}>{entry.grade}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* ── Star Rating Breakdown ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t.routeStats?.rating || 'דירוג'}
        </Text>

        <View style={styles.ratingContainer}>
          {/* Left: big average number + stars + total */}
          <View style={styles.ratingLeft}>
            <Text style={styles.ratingBigNumber}>
              {averageStarRating > 0 ? averageStarRating.toFixed(1) : '0.0'}
            </Text>
            <View style={styles.ratingStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text
                  key={star}
                  style={[
                    styles.ratingStar,
                    star <= Math.round(averageStarRating) && styles.ratingStarFilled,
                  ]}
                >
                  ★
                </Text>
              ))}
            </View>
            <View style={styles.totalRow}>
              <Ionicons name="person" size={14} color={theme.textSecondary} />
              <Text style={styles.totalText}>
                {totalStarVotes} {t.routeStats?.total || 'total'}
              </Text>
            </View>
          </View>

          {/* Right: per-star horizontal bars */}
          <View style={styles.ratingRight}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = starDistribution[star] || 0;
              const barWidth =
                totalStarVotes > 0
                  ? Math.max(4, (count / maxStarCount) * 100)
                  : 4;
              return (
                <View key={star} style={styles.starBarRow}>
                  <Text style={styles.starBarLabel}>{star}</Text>
                  <View style={styles.starBarTrack}>
                    <View
                      style={[
                        styles.starBarFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor:
                            count > 0
                              ? theme.starColor || '#F59E0B'
                              : theme.border,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: 16,
    },
    // Climbed by
    climbedByRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.isDark ? 'rgba(16,185,129,0.1)' : '#F0FDF4',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(16,185,129,0.25)' : '#BBF7D0',
    },
    climbedByText: {
      fontSize: 15,
      color: theme.isDark ? '#6EE7B7' : '#166534',
      fontWeight: '500',
    },
    climbedByCount: {
      fontWeight: '800',
      fontSize: 17,
    },
    // Sections
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    // Grade chart
    gradeChartContainer: {
      backgroundColor: theme.card || theme.surface,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    gradeBarsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: 6,
    },
    gradeBarWrapper: {
      alignItems: 'center',
      minWidth: 32,
    },
    gradeBarCount: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary || '#E91E63',
      marginBottom: 4,
    },
    gradeBar: {
      width: 28,
      borderRadius: 4,
      minHeight: 8,
    },
    gradeBarLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 6,
      fontWeight: '500',
    },
    // Rating breakdown
    ratingContainer: {
      flexDirection: 'row',
      backgroundColor: theme.card || theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 20,
    },
    ratingLeft: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
    },
    ratingBigNumber: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.text,
    },
    ratingStarsRow: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 4,
    },
    ratingStar: {
      fontSize: 18,
      color: theme.border,
    },
    ratingStarFilled: {
      color: theme.starColor || '#F59E0B',
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    totalText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    // Star bars
    ratingRight: {
      flex: 1,
      justifyContent: 'center',
      gap: 5,
    },
    starBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    starBarLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      width: 14,
      textAlign: 'center',
    },
    starBarTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
      overflow: 'hidden',
    },
    starBarFill: {
      height: '100%',
      borderRadius: 4,
    },
  });
