/**
 * @fileoverview Competition Leaderboard Component
 * @description Displays competition rankings grouped by categories (sections)
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import { useLanguage } from '@/features/language';
import {
  useCompetitionLeaderboard,
  useParticipants,
} from '@/features/competitions/hooks/useCompetition';
import {
  Competition,
  LeaderboardEntry,
  Category,
  Participant,
  CompetitionFormat,
} from '@/features/competitions/types';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { ResultsService } from '@/features/competitions/services/ResultsService';
import { formatPoints, formatIFSCResult, isZoneTopFormat } from '@/features/competitions/constants';
import { CachedAvatar } from '@/components/ui/CachedAvatar';

interface CompetitionLeaderboardProps {
  competition: Competition;
  currentUserId?: string;
  onParticipantPress?: (participantId: string) => void;
}

// Interface for category leaderboard data
interface CategoryLeaderboardData {
  category: Category;
  entries: LeaderboardEntry[];
  participants: Participant[];
  loading: boolean;
}

/**
 * Hook to subscribe to ALL leaderboard entries once (for all categories)
 * This prevents N+1 queries when rendering multiple category sections
 */
function useAllLeaderboardEntries(
  competitionId: string | null,
  format: CompetitionFormat
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!competitionId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Fetch ALL entries without category filter - filter later on client side
    let unsubscribe: () => void;
    if (format === 'totemtition') {
      unsubscribe = ResultsService.subscribeToTotemtitionLeaderboard(
        competitionId,
        (leaderboard) => {
          setEntries(leaderboard);
          setLoading(false);
        }
      );
    } else if (isZoneTopFormat(format)) {
      unsubscribe = ResultsService.subscribeToZoneTopLeaderboard(
        competitionId,
        (leaderboard) => {
          setEntries(leaderboard);
          setLoading(false);
        }
      );
    } else {
      unsubscribe = ResultsService.subscribeToLeaderboard(
        competitionId,
        (leaderboard) => {
          setEntries(leaderboard);
          setLoading(false);
        }
      );
    }

    return () => unsubscribe();
  }, [competitionId, format]);

  return { entries, loading };
}

/**
 * Hook to subscribe to ALL participants once
 * This prevents N+1 queries when rendering multiple category sections
 */
function useAllParticipants(competitionId: string | null) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!competitionId) {
      setParticipants([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    const unsubscribe = ParticipantService.subscribeToParticipants(
      competitionId,
      (allParticipants) => {
        setParticipants(allParticipants);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [competitionId]);

  return { participants, loading };
}

/**
 * Component to render a single category section
 * Now receives pre-filtered data from parent to avoid N+1 queries
 */
function CategorySection({
  category,
  categoryEntries,
  categoryParticipants,
  currentUserId,
  onParticipantPress,
  theme,
  t,
  styles,
  isZoneTop,
}: {
  category: Category;
  categoryEntries: LeaderboardEntry[];
  categoryParticipants: Participant[];
  currentUserId?: string;
  onParticipantPress?: (participantId: string) => void;
  theme: any;
  t: any;
  styles: any;
  isZoneTop?: boolean;
}) {
  // Merge leaderboard entries with participants who don't have scores yet
  const allEntries = useMemo(() => {
    const leaderboardMap = new Map<string, LeaderboardEntry>();
    categoryEntries.forEach(entry => {
      leaderboardMap.set(entry.userId || entry.participantId, entry);
    });

    const merged: LeaderboardEntry[] = [...categoryEntries];

    categoryParticipants.forEach(participant => {
      const participantKey = participant.userId || participant.id;
      if (!leaderboardMap.has(participantKey)) {
        merged.push({
          rank: 0,
          participantId: participant.id,
          participantName: participant.userName || participant.name || 'Unknown',
          userName: participant.userName || participant.name || 'Unknown',
          userId: participant.userId,
          photoURL: participant.photoURL || null,
          points: 0,
          totalPoints: 0,
          routesCompleted: 0,
          category: participant.category,
          categoryName: participant.categoryName,
        });
      }
    });

    // Sort by points (descending), then assign ranks
    merged.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    let currentRank = 1;
    for (let i = 0; i < merged.length; i++) {
      if (merged[i].points === 0) {
        merged[i].rank = 0;
      } else if (i === 0) {
        merged[i].rank = currentRank;
      } else if ((merged[i].points || 0) === (merged[i - 1].points || 0)) {
        merged[i].rank = merged[i - 1].rank;
      } else {
        merged[i].rank = i + 1;
        currentRank = i + 1;
      }
    }

    return merged;
  }, [categoryEntries, categoryParticipants]);

  // Top 3 for podium (only those with scores)
  const topThree = useMemo(() => allEntries.filter(e => e.points > 0).slice(0, 3), [allEntries]);
  
  // Rest of entries (4th place onwards, including those without scores)
  const restOfEntries = useMemo(() => {
    const withScores = allEntries.filter(e => e.points > 0).slice(3);
    const withoutScores = allEntries.filter(e => e.points === 0);
    return [...withScores, ...withoutScores];
  }, [allEntries]);

  const renderPodium = () => {
    if (topThree.length === 0) return null;

    const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd

    return (
      <View style={styles.podiumContainer}>
        <View style={styles.podiumRow}>
          {podiumOrder.map((index) => {
            const entry = topThree[index];
            if (!entry) return <View key={index} style={styles.podiumPlace} />;

            const stepStyle =
              index === 0
                ? styles.podiumStep1
                : index === 1
                ? styles.podiumStep2
                : styles.podiumStep3;

            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';

            return (
              <TouchableOpacity
                key={entry.participantId}
                style={styles.podiumPlace}
                onPress={() => onParticipantPress?.(entry.participantId)}
                activeOpacity={0.7}
              >
                <View style={stepStyle}>
                  <Text style={styles.podiumRank}>{entry.rank}</Text>
                </View>
                <CachedAvatar
                  photoURL={entry.photoURL}
                  displayName={entry.participantName || 'U'}
                  size={60}
                  
                  showBorder={false}
                />
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.participantName || entry.userName || 'Unknown'}
                </Text>
                {isZoneTop && entry.totalTops !== undefined ? (
                  <>
                    <Text style={styles.podiumPoints}>
                      {formatIFSCResult(entry.totalTops || 0, entry.totalZones || 0, entry.totalTopAttempts || 0, entry.totalZoneAttempts || 0)}
                    </Text>
                    <Text style={styles.podiumPoints}>
                      {formatPoints(entry.points)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.podiumPoints}>
                    {formatPoints(entry.points)}
                  </Text>
                )}
                <Text style={styles.podiumMedal}>{medal}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderLeaderboardItem = (item: LeaderboardEntry) => {
    const isCurrentUser = item.userId === currentUserId;
    const displayName = item.participantName || item.userName || 'Unknown';
    const hasScore = (item.points || 0) > 0;
    const ifscLine = isZoneTop && hasScore
      ? formatIFSCResult(item.totalTops || 0, item.totalZones || 0, item.totalTopAttempts || 0, item.totalZoneAttempts || 0)
      : null;

    return (
      <TouchableOpacity
        key={item.participantId}
        style={[
          styles.listItem, 
          isCurrentUser && styles.currentUserItem,
          !hasScore && styles.noScoreItem,
        ]}
        onPress={() => onParticipantPress?.(item.participantId)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rankNumber, !hasScore && styles.noScoreRank]}>
            {hasScore ? item.rank : '-'}
          </Text>
        </View>

        <CachedAvatar
          photoURL={item.photoURL}
          displayName={displayName}
          size={45}
          
          showBorder={false}
        />

        <View style={styles.infoContainer}>
          <Text
            style={[styles.nameText, isCurrentUser && styles.currentUserName]}
            numberOfLines={1}
          >
            {displayName}
            {isCurrentUser && <Text> {t.social.you}</Text>}
          </Text>
          <Text style={[styles.statsText, !hasScore && styles.noScoreText]}>
            {hasScore 
              ? ifscLine
                ? `${ifscLine} | ${formatPoints(item.points)}`
                : `${item.routesCompleted} ${t.competition.routesCompleted} | ${formatPoints(item.points)}`
              : t.competition.noScoreYet || 'אין ניקוד עדיין'
            }
          </Text>
        </View>
      </TouchableOpacity>
    );
  };


  return (
    <View style={styles.categorySectionContainer}>
      {/* Category Header */}
      <View style={styles.categorySectionHeader}>
        <Text style={styles.categorySectionTitle}>{category.name}</Text>
        <View style={styles.categoryParticipantCount}>
          <Text style={styles.categoryParticipantCountText}>
            {allEntries.length} {t.competition.participants}
          </Text>
        </View>
      </View>

      {/* Podium for this category */}
      {renderPodium()}

      {/* Rest of entries for this category */}
      {restOfEntries.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>{t.social.otherPlaces}</Text>
          {restOfEntries.map(renderLeaderboardItem)}
        </View>
      )}

      {/* Empty state for this category */}
      {allEntries.length === 0 && (
        <View style={styles.categoryEmptyContainer}>
          <Text style={styles.categoryEmptyText}>
            {t.competition.noResultsYet}
          </Text>
        </View>
      )}
    </View>
  );
}

export function CompetitionLeaderboard({
  competition,
  currentUserId,
  onParticipantPress,
}: CompetitionLeaderboardProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Fetch categories from subcollection
  useEffect(() => {
    setCategoriesLoading(true);
    ParticipantService.getCategories(competition.id)
      .then((fetchedCategories) => {
        console.log('[CompetitionLeaderboard] Fetched categories:', fetchedCategories.length, fetchedCategories.map(c => c.name));
        setCategories(fetchedCategories);
      })
      .catch((err) => {
        console.log('[CompetitionLeaderboard] Error fetching categories:', err);
        setCategories([]);
      })
      .finally(() => setCategoriesLoading(false));
  }, [competition.id]);

  // Determine if we should show categories
  // Check both the setting AND if we actually have categories
  const hasCategories = competition.settings?.enableCategories && categories.length > 0;
  const isZoneTop = isZoneTopFormat(competition.format);
  
  const styles = createStyles(theme);

  // OPTIMIZATION: Fetch ALL data ONCE at parent level to avoid N+1 queries
  // When hasCategories is true, we fetch all entries and participants here,
  // then filter per category in useMemo (no separate subscriptions per category)
  const { entries: allEntries, loading: allEntriesLoading } = useAllLeaderboardEntries(
    hasCategories ? competition.id : null,
    competition.format
  );
  
  const { participants: allParticipantsForCategories, loading: allParticipantsLoading } = useAllParticipants(
    hasCategories ? competition.id : null
  );

  // For competitions without categories, use the original single-category view
  const { entries, loading: leaderboardLoading, error } = useCompetitionLeaderboard(
    hasCategories ? null : competition.id, // Only fetch if no categories
    undefined,
    competition.format
  );

  const { participants, loading: participantsLoading, count: totalParticipantCount } = useParticipants(
    competition.id,
    undefined // Get all participants for count
  );

  const loading = categoriesLoading || 
    (hasCategories ? (allEntriesLoading || allParticipantsLoading) : (leaderboardLoading || participantsLoading));

  // Pre-filter entries and participants per category (memoized for performance)
  const categoryDataMap = useMemo(() => {
    if (!hasCategories) return new Map<string, { entries: LeaderboardEntry[]; participants: Participant[] }>();
    
    const map = new Map<string, { entries: LeaderboardEntry[]; participants: Participant[] }>();
    
    categories.forEach(category => {
      const categoryEntries = allEntries.filter(e => e.category === category.id);
      const categoryParticipants = allParticipantsForCategories.filter(p => p.category === category.id);
      map.set(category.id, { entries: categoryEntries, participants: categoryParticipants });
    });
    
    return map;
  }, [hasCategories, categories, allEntries, allParticipantsForCategories]);

  // Sync missing categories when leaderboard loads (for per-category scoring)
  // This runs more aggressively to catch category changes and new registrations
  useEffect(() => {
    if (!loading && competition.settings?.enableCategories) {
      // Always check for missing categories in entries when categories are enabled
      const checkAndSync = async () => {
        try {
          const missingCategories = await ResultsService.getResultsWithMissingCategories(competition.id);
          if (missingCategories.length > 0) {
            console.log(`[CompetitionLeaderboard] Found ${missingCategories.length} results with missing categories, syncing...`);
            await ResultsService.syncResultCategories(competition.id);
          }
        } catch (err) {
          console.log('Failed to check/sync categories:', err);
        }
      };
      checkAndSync();
    }
  }, [loading, competition.id, competition.settings?.enableCategories]);

  // For no-category competitions: merge entries with participants
  const allEntriesNoCategory = useMemo(() => {
    if (hasCategories) return [];

    const leaderboardMap = new Map<string, LeaderboardEntry>();
    entries.forEach(entry => {
      leaderboardMap.set(entry.userId || entry.participantId, entry);
    });

    const merged: LeaderboardEntry[] = [...entries];

    participants.forEach(participant => {
      const participantKey = participant.userId || participant.id;
      if (!leaderboardMap.has(participantKey)) {
        merged.push({
          rank: 0,
          participantId: participant.id,
          participantName: participant.userName || participant.name || 'Unknown',
          userName: participant.userName || participant.name || 'Unknown',
          userId: participant.userId,
          photoURL: participant.photoURL || null,
          points: 0,
          totalPoints: 0,
          routesCompleted: 0,
          category: participant.category,
          categoryName: participant.categoryName,
        });
      }
    });

    merged.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    let currentRank = 1;
    for (let i = 0; i < merged.length; i++) {
      if (merged[i].points === 0) {
        merged[i].rank = 0;
      } else if (i === 0) {
        merged[i].rank = currentRank;
      } else if ((merged[i].points || 0) === (merged[i - 1].points || 0)) {
        merged[i].rank = merged[i - 1].rank;
      } else {
        merged[i].rank = i + 1;
        currentRank = i + 1;
      }
    }

    return merged;
  }, [entries, participants, hasCategories]);

  // Top 3 for podium (only those with scores) - for no-category competitions
  const topThree = useMemo(() => allEntriesNoCategory.filter(e => e.points > 0).slice(0, 3), [allEntriesNoCategory]);
  
  // Rest of entries - for no-category competitions
  const restOfEntries = useMemo(() => {
    const withScores = allEntriesNoCategory.filter(e => e.points > 0).slice(3);
    const withoutScores = allEntriesNoCategory.filter(e => e.points === 0);
    return [...withScores, ...withoutScores];
  }, [allEntriesNoCategory]);

  const renderPodium = () => {
    if (topThree.length === 0) return null;

    const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd

    return (
      <View style={styles.podiumContainer}>
        <View style={styles.podiumRow}>
          {podiumOrder.map((index) => {
            const entry = topThree[index];
            if (!entry) return <View key={index} style={styles.podiumPlace} />;

            const stepStyle =
              index === 0
                ? styles.podiumStep1
                : index === 1
                ? styles.podiumStep2
                : styles.podiumStep3;

            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';

            return (
              <TouchableOpacity
                key={entry.participantId}
                style={styles.podiumPlace}
                onPress={() => onParticipantPress?.(entry.participantId)}
                activeOpacity={0.7}
              >
                <View style={stepStyle}>
                  <Text style={styles.podiumRank}>{entry.rank}</Text>
                </View>
                <CachedAvatar
                  photoURL={entry.photoURL}
                  displayName={entry.participantName || 'U'}
                  size={60}
                  
                  showBorder={false}
                />
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.participantName || entry.userName || 'Unknown'}
                </Text>
                {isZoneTop && entry.totalTops !== undefined ? (
                  <>
                    <Text style={styles.podiumPoints}>
                      {formatIFSCResult(entry.totalTops || 0, entry.totalZones || 0, entry.totalTopAttempts || 0, entry.totalZoneAttempts || 0)}
                    </Text>
                    <Text style={styles.podiumPoints}>
                      {formatPoints(entry.points)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.podiumPoints}>
                    {formatPoints(entry.points)}
                  </Text>
                )}
                <Text style={styles.podiumMedal}>{medal}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const isCurrentUser = item.userId === currentUserId;
    const displayName = item.participantName || item.userName || 'Unknown';
    const hasScore = (item.points || 0) > 0;
    const ifscLine = isZoneTop && hasScore
      ? formatIFSCResult(item.totalTops || 0, item.totalZones || 0, item.totalTopAttempts || 0, item.totalZoneAttempts || 0)
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.listItem, 
          isCurrentUser && styles.currentUserItem,
          !hasScore && styles.noScoreItem,
        ]}
        onPress={() => onParticipantPress?.(item.participantId)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rankNumber, !hasScore && styles.noScoreRank]}>
            {hasScore ? item.rank : '-'}
          </Text>
        </View>

        <CachedAvatar
          photoURL={item.photoURL}
          displayName={displayName}
          size={45}
          
          showBorder={false}
        />

        <View style={styles.infoContainer}>
          <Text
            style={[styles.nameText, isCurrentUser && styles.currentUserName]}
            numberOfLines={1}
          >
            {displayName}
            {isCurrentUser && <Text> {t.social.you}</Text>}
          </Text>
          <Text style={[styles.statsText, !hasScore && styles.noScoreText]}>
            {hasScore 
              ? ifscLine
                ? `${ifscLine} | ${formatPoints(item.points)}`
                : `${item.routesCompleted} ${t.competition.routesCompleted} | ${formatPoints(item.points)}`
              : t.competition.noScoreYet || 'אין ניקוד עדיין'
            }
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>{t.competition.loadingCompetition}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t.competition.errorLoadingLeaderboard}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Competition Stats */}
      <View style={styles.statsHeader}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalParticipantCount}</Text>
          <Text style={styles.statLabel}>{t.competition.participants}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {competition.settings.maxRoutes}
          </Text>
          <Text style={styles.statLabel}>{t.competition.routesCompleted}</Text>
        </View>
        {!isZoneTop && (
          <View style={styles.statBox}>
            <Text style={styles.statValue}>TOP{competition.settings.topRoutesForScoring}</Text>
            <Text style={styles.statLabel}>{t.competition.scoring}</Text>
          </View>
        )}
      </View>

      {/* If has categories - show each category as a section */}
      {hasCategories ? (
        categories.map((category) => {
          const categoryData = categoryDataMap.get(category.id) || { entries: [], participants: [] };
          return (
            <CategorySection
              key={category.id}
              category={category}
              categoryEntries={categoryData.entries}
              categoryParticipants={categoryData.participants}
              currentUserId={currentUserId}
              onParticipantPress={onParticipantPress}
              theme={theme}
              t={t}
              styles={styles}
              isZoneTop={isZoneTop}
            />
          );
        })
      ) : (
        /* No categories - show single leaderboard */
        <>
          {/* Podium */}
          {renderPodium()}

          {/* Rest of the list */}
          {restOfEntries.length > 0 && (
            <View style={styles.listSection}>
              <Text style={styles.listTitle}>{t.social.otherPlaces}</Text>
              <FlatList
                data={restOfEntries}
                keyExtractor={(item) => item.participantId}
                renderItem={renderLeaderboardItem}
                scrollEnabled={false}
              />
            </View>
          )}

          {entries.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t.competition.noResultsYet}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorText: {
      fontSize: 16,
      color: theme.error || '#e74c3c',
    },
    statsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.surface,
      paddingVertical: 15,
      marginBottom: 10,
    },
    statBox: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    categoryTabs: {
      flexDirection: 'row',
      paddingHorizontal: 15,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      marginBottom: 10,
    },
    categoryTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginEnd: 8,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    },
    categoryTabActive: {
      backgroundColor: theme.primary,
    },
    categoryTabText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    categoryTabTextActive: {
      color: '#fff',
      fontWeight: 'bold',
    },
    podiumContainer: {
      backgroundColor: theme.surface,
      padding: 20,
      marginBottom: 10,
    },
    podiumRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      height: 180,
    },
    podiumPlace: {
      alignItems: 'center',
      marginHorizontal: 8,
      flex: 1,
    },
    podiumStep1: {
      backgroundColor: '#f1c40f',
      height: 70,
      width: '100%',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    podiumStep2: {
      backgroundColor: '#95a5a6',
      height: 55,
      width: '100%',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    podiumStep3: {
      backgroundColor: '#cd7f32',
      height: 40,
      width: '100%',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    podiumRank: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    podiumAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      borderWidth: 2,
      borderColor: '#fff',
    },
    podiumAvatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginBottom: 4,
      borderWidth: 2,
      borderColor: '#fff',
    },
    podiumAvatarText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    podiumName: {
      fontSize: 12,
      fontWeight: 'bold',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 2,
    },
    podiumPoints: {
      fontSize: 10,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    podiumMedal: {
      fontSize: 18,
    },
    listSection: {
      backgroundColor: theme.surface,
      paddingTop: 15,
    },
    listTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      paddingHorizontal: 15,
      marginBottom: 10,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginVertical: 4,
      marginHorizontal: 15,
      padding: 14,
      borderRadius: 12,
    },
    currentUserItem: {
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.isDark ? 'rgba(99, 102, 241, 0.15)' : '#f0f0ff',
    },
    noScoreItem: {
      opacity: 0.7,
      backgroundColor: theme.isDark ? 'rgba(128,128,128,0.1)' : 'rgba(200,200,200,0.2)',
    },
    rankContainer: {
      width: 36,
      alignItems: 'center',
    },
    rankNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    noScoreRank: {
      color: theme.textSecondary,
    },
    avatarContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 12,
    },
    avatarImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginHorizontal: 12,
    },
    avatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    infoContainer: {
      flex: 1,
    },
    nameText: {
      fontSize: 15,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 2,
    },
    currentUserName: {
      color: theme.primary,
    },
    statsText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    noScoreText: {
      fontStyle: 'italic',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    // Category Section Styles
    categorySectionContainer: {
      marginBottom: 20,
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginHorizontal: 0,
      overflow: 'hidden',
    },
    categorySectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.primary,
    },
    categorySectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    categoryParticipantCount: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    categoryParticipantCountText: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
      fontWeight: '500',
    },
    categoryEmptyContainer: {
      padding: 30,
      alignItems: 'center',
    },
    categoryEmptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });

export default CompetitionLeaderboard;
