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
  Share,
  Alert,
  Platform,
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
import { exportLeaderboardCsv } from '@/features/competitions/services/LeaderboardExport';
import { ResultHistoryModal } from '@/features/competitions/components/ResultHistoryModal';
import { formatPoints, formatIFSCResult, isZoneTopFormat } from '@/features/competitions/constants';
import { CachedAvatar } from '@/components/ui/CachedAvatar';
import { useAdmin } from '@/context/AdminContext';
import { useRolesContext } from '@/features/roles';

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
 * Lightweight shimmer row used as a loading placeholder for the leaderboard.
 * We avoid Animated here so that the component is cheap to render during the
 * brief window between mount and the first Firestore snapshot.
 */
function LeaderboardSkeleton({ theme, count = 6 }: { theme: any; count?: number }) {
  const bg = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const podiumRowStyle = {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'flex-end' as const,
    paddingVertical: 18,
  };
  return (
    <View style={{ width: '100%' }}>
      <View style={podiumRowStyle}>
        {[70, 90, 55].map((h, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: bg, marginBottom: 8 }} />
            <View style={{ width: 60, height: 10, backgroundColor: bg, borderRadius: 4, marginBottom: 6 }} />
            <View style={{ width: 70, height: h, backgroundColor: bg, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
          </View>
        ))}
      </View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <View style={{ width: 24, height: 16, borderRadius: 4, backgroundColor: bg }} />
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: bg }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '60%', height: 12, borderRadius: 4, backgroundColor: bg }} />
            <View style={{ width: '40%', height: 10, borderRadius: 4, backgroundColor: bg }} />
          </View>
        </View>
      ))}
    </View>
  );
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
  onParticipantLongPress,
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
  onParticipantLongPress?: (participantId: string, name?: string) => void;
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

  // Set of ranks that are shared by 2+ climbers – used to surface the
  // secondary tie-breaker metric (total attempts) on those rows.
  const tiedRanks = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of allEntries) {
      if (e.rank > 0) counts.set(e.rank, (counts.get(e.rank) || 0) + 1);
    }
    const set = new Set<number>();
    for (const [rank, count] of counts) {
      if (count > 1) set.add(rank);
    }
    return set;
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
    const isTied = hasScore && tiedRanks.has(item.rank);
    const tieAttempts = typeof item.totalAttempts === 'number' ? item.totalAttempts : undefined;
    const attemptsLabel = (t.competition as any)?.attempts || 'ניסיונות';

    return (
      <TouchableOpacity
        key={item.participantId}
        style={[
          styles.listItem, 
          isCurrentUser && styles.currentUserItem,
          !hasScore && styles.noScoreItem,
        ]}
        onPress={() => onParticipantPress?.(item.participantId)}
        onLongPress={() =>
          onParticipantLongPress?.(item.participantId, displayName)
        }
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rankNumber, !hasScore && styles.noScoreRank]}>
            {hasScore ? (isTied ? `${item.rank}=` : item.rank) : '-'}
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
          {isTied && tieAttempts !== undefined && (
            <Text style={styles.tieHintText}>
              שובר שוויון: {tieAttempts} {attemptsLabel}
            </Text>
          )}
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
  const { isAdmin } = useAdmin();
  const { isHeadJudge, isJudgeRole } = useRolesContext();
  // Any competition staff (admin / head judge / judge) may export the results.
  // These roles already have read access to the private identity data (Firestore
  // rules), so the export — including national-league ID numbers — is consistent
  // with what they can already see.
  const canExportResults = isAdmin || isHeadJudge || isJudgeRole;
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{
    participantId: string;
    name?: string;
  } | null>(null);

  // Fetch categories from subcollection. Categories are auxiliary data –
  // the leaderboard renders immediately with or without them, so we do NOT
  // block the whole screen while they load.
  useEffect(() => {
    let cancelled = false;
    ParticipantService.getCategories(competition.id)
      .then((fetchedCategories) => {
        if (cancelled) return;
        console.log('[CompetitionLeaderboard] Fetched categories:', fetchedCategories.length, fetchedCategories.map(c => c.name));
        setCategories(fetchedCategories);
      })
      .catch((err) => {
        if (cancelled) return;
        console.log('[CompetitionLeaderboard] Error fetching categories:', err);
        setCategories([]);
      });
    return () => { cancelled = true; };
  }, [competition.id]);

  // Determine if we should show categories
  // Show categories whenever they exist, regardless of enableCategories setting
  const hasCategories = categories.length > 0;
  const isZoneTop = isZoneTopFormat(competition.format);
  
  const styles = createStyles(theme);

  // OPTIMIZATION: Single source of truth for entries + participants.
  // We subscribe once regardless of whether categories exist, and derive
  // both the categorised view and the flat view from the same data. This
  // eliminates the previous double-subscription (useAllParticipants +
  // useParticipants) which hit the same collection twice.
  const { entries: allEntries, loading: leaderboardLoading, error } = useCompetitionLeaderboard(
    competition.id,
    undefined,
    competition.format,
    competition.settings
  );

  const {
    participants,
    loading: participantsLoading,
    count: totalParticipantCount,
  } = useParticipants(competition.id, undefined);

  // Categories are auxiliary – don't block first paint on them.
  const dataLoading = leaderboardLoading || participantsLoading;
  const loading = dataLoading;

  // Pre-filter entries and participants per category (memoized for performance)
  const categoryDataMap = useMemo(() => {
    if (!hasCategories) return new Map<string, { entries: LeaderboardEntry[]; participants: Participant[] }>();
    
    const map = new Map<string, { entries: LeaderboardEntry[]; participants: Participant[] }>();
    
    const assignedCategoryIds = new Set<string>();
    categories.forEach(category => {
      const categoryEntries = allEntries.filter(e => e.category === category.id);
      const categoryParticipants = participants.filter(p => p.category === category.id);
      map.set(category.id, { entries: categoryEntries, participants: categoryParticipants });
      categoryEntries.forEach(e => assignedCategoryIds.add(e.userId || e.participantId));
      categoryParticipants.forEach(p => assignedCategoryIds.add(p.userId || p.id));
    });

    // Collect uncategorized entries/participants
    const uncategorizedEntries = allEntries.filter(e => !e.category || !categories.some(c => c.id === e.category));
    const uncategorizedParticipants = participants.filter(p => !p.category || !categories.some(c => c.id === p.category));
    if (uncategorizedEntries.length > 0 || uncategorizedParticipants.length > 0) {
      map.set('__uncategorized__', { entries: uncategorizedEntries, participants: uncategorizedParticipants });
    }
    
    return map;
  }, [hasCategories, categories, allEntries, participants]);

  // Uncategorized label: read once via ref so we don't invalidate the tabs
  // memo every time the language context re-creates `t`.
  const uncategorizedLabelRef = useRef<string>(t.competition?.general || 'כללי');
  uncategorizedLabelRef.current = t.competition?.general || 'כללי';
  const hasUncategorized = categoryDataMap.has('__uncategorized__');

  // Build the list of category tabs (including uncategorized if needed).
  // Uses only stable primitive deps so the array identity does not change on
  // every re-render or language change.
  const allCategoryTabs = useMemo(() => {
    const tabs: { id: string; name: string }[] = categories.map(c => ({ id: c.id, name: c.name }));
    if (hasUncategorized) {
      tabs.push({ id: '__uncategorized__', name: uncategorizedLabelRef.current });
    }
    return tabs;
  }, [categories, hasUncategorized]);

  // Auto-select the current user's category on first load
  useEffect(() => {
    if (!hasCategories || selectedCategoryId !== null || !currentUserId) return;
    // Find which category the current user belongs to
    const userParticipant = participants.find(p => p.userId === currentUserId);
    if (userParticipant?.category && categories.some(c => c.id === userParticipant.category)) {
      setSelectedCategoryId(userParticipant.category);
    } else if (allCategoryTabs.length > 0) {
      setSelectedCategoryId(allCategoryTabs[0].id);
    }
  }, [hasCategories, selectedCategoryId, currentUserId, participants, categories, allCategoryTabs]);

  // If no user and no selection yet, default to first category
  useEffect(() => {
    if (hasCategories && selectedCategoryId === null && allCategoryTabs.length > 0 && !participantsLoading) {
      setSelectedCategoryId(allCategoryTabs[0].id);
    }
  }, [hasCategories, selectedCategoryId, allCategoryTabs, participantsLoading]);

  // Sync missing categories ONCE per competition (not on every render cycle).
  // The previous implementation ran a full-collection scan every time `loading`
  // toggled or `categories.length` changed, which happened on every subscription
  // update during live scoring.
  const categorySyncRanForCompetitionRef = useRef<string | null>(null);
  useEffect(() => {
    if (dataLoading) return;
    if (categories.length === 0) return;
    if (categorySyncRanForCompetitionRef.current === competition.id) return;
    categorySyncRanForCompetitionRef.current = competition.id;

    (async () => {
      try {
        const missingCategories = await ResultsService.getResultsWithMissingCategories(competition.id);
        if (missingCategories.length > 0) {
          console.log(
            `[CompetitionLeaderboard] Found ${missingCategories.length} results with missing categories, syncing once...`,
          );
          await ResultsService.syncResultCategories(competition.id);
        }
      } catch (err) {
        console.log('Failed to check/sync categories:', err);
      }
    })();
  }, [dataLoading, competition.id, categories.length]);

  // For no-category competitions: merge entries with participants
  const allEntriesNoCategory = useMemo(() => {
    if (hasCategories) return [];

    const leaderboardMap = new Map<string, LeaderboardEntry>();
    allEntries.forEach(entry => {
      leaderboardMap.set(entry.userId || entry.participantId, entry);
    });

    const merged: LeaderboardEntry[] = [...allEntries];

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
  }, [allEntries, participants, hasCategories]);

  // Top 3 for podium (only those with scores) - for no-category competitions
  const topThree = useMemo(() => allEntriesNoCategory.filter(e => e.points > 0).slice(0, 3), [allEntriesNoCategory]);
  
  // Rest of entries - for no-category competitions
  const restOfEntries = useMemo(() => {
    const withScores = allEntriesNoCategory.filter(e => e.points > 0).slice(3);
    const withoutScores = allEntriesNoCategory.filter(e => e.points === 0);
    return [...withScores, ...withoutScores];
  }, [allEntriesNoCategory]);

  // Tie-breaker ranks for the flat no-category leaderboard.
  const tiedRanks = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of allEntriesNoCategory) {
      if (e.rank > 0) counts.set(e.rank, (counts.get(e.rank) || 0) + 1);
    }
    const set = new Set<number>();
    for (const [rank, count] of counts) {
      if (count > 1) set.add(rank);
    }
    return set;
  }, [allEntriesNoCategory]);

  // Build a CSV (UTF-8 with BOM, so it opens directly in Excel / Google Sheets)
  // for the full leaderboard and hand it to the OS share sheet. For national-league
  // competitions the export also includes each participant's ID number + birth year,
  // fetched from the staff-only private subcollection.
  const handleExportCsv = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      // Build a complete row set: every participant across EVERY category,
      // including those with no score yet. `allEntries` already spans all
      // categories (the per-category tabs only filter it for display), and
      // buildLeaderboardCsv groups the rows back into per-category sections.
      const rowsMap = new Map<string, LeaderboardEntry>();
      allEntries.forEach((e) => rowsMap.set(e.userId || e.participantId, e));
      participants.forEach((p) => {
        const key = p.userId || p.id;
        if (!rowsMap.has(key)) {
          rowsMap.set(key, {
            rank: 0,
            participantId: p.id,
            participantName: p.userName || p.name || 'Unknown',
            userName: p.userName || p.name || 'Unknown',
            userId: p.userId,
            photoURL: p.photoURL || null,
            points: 0,
            totalPoints: 0,
            routesCompleted: 0,
            category: p.category,
            categoryName: p.categoryName,
          } as LeaderboardEntry);
        }
      });
      const rows = Array.from(rowsMap.values());
      let participantsById:
        | Record<string, { idNumber?: string | null; birthYear?: number | null }>
        | undefined;
      if (competition.settings?.nationalLeague) {
        // National-league identity columns (ID number + birth year). Best-effort:
        // if the private data can't be fetched, still export the rest of the CSV.
        try {
          const [nlParticipants, privateIds] = await Promise.all([
            ParticipantService.getParticipants(competition.id),
            ParticipantService.getParticipantsPrivate(competition.id),
          ]);
          participantsById = {};
          nlParticipants.forEach((p) => {
            participantsById![p.id] = {
              idNumber: privateIds[p.id] ?? null,
              birthYear: p.birthYear ?? null,
            };
          });
        } catch (idErr) {
          console.warn('[CSV export] could not load private identity data', idErr);
        }
      }
      await exportLeaderboardCsv(competition, rows, {
        uncategorizedLabel: (t.competition as any)?.uncategorized || 'ללא קטגוריה',
        participantsById,
      });
    } catch (e) {
      console.warn('[CSV export] failed', e);
      Alert.alert(t.common?.error || 'שגיאה', t.competition.exportFailed);
    } finally {
      setExporting(false);
    }
  };

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
    const isTied = hasScore && tiedRanks.has(item.rank);
    const tieAttempts = typeof item.totalAttempts === 'number' ? item.totalAttempts : undefined;
    const attemptsLabel = (t.competition as any)?.attempts || 'ניסיונות';

    return (
      <TouchableOpacity
        style={[
          styles.listItem, 
          isCurrentUser && styles.currentUserItem,
          !hasScore && styles.noScoreItem,
        ]}
        onPress={() => onParticipantPress?.(item.participantId)}
        onLongPress={() => {
          if (isAdmin) {
            setHistoryTarget({
              participantId: item.participantId,
              name: displayName,
            });
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rankNumber, !hasScore && styles.noScoreRank]}>
            {hasScore ? (isTied ? `${item.rank}=` : item.rank) : '-'}
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
          {isTied && tieAttempts !== undefined && (
            <Text style={styles.tieHintText}>
              שובר שוויון: {tieAttempts} {attemptsLabel}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state now renders inline skeletons so the screen structure paints
  // immediately. The full-screen ActivityIndicator was making the tab feel
  // sluggish because it delayed the first visible frame.
  if (loading) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.statsHeader}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>{t.competition.participants}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>{t.competition.routesCompleted}</Text>
          </View>
          {!isZoneTop && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>{t.competition.scoring}</Text>
            </View>
          )}
        </View>
        <LeaderboardSkeleton theme={theme} />
      </ScrollView>
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
    <>
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

      {/* Prominent export button for competition staff. Produces a CSV (UTF-8 with
          BOM) that opens directly in Excel / Google Sheets. */}
      {canExportResults && (
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExportCsv}
          activeOpacity={0.7}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.exportButtonIcon}>⬇</Text>
              <Text style={styles.exportButtonText}>{t.competition.exportResultsCsv}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* If has categories - show category tabs + selected category leaderboard */}
      {hasCategories ? (
        <>
          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {allCategoryTabs.map((tab) => {
              const isActive = selectedCategoryId === tab.id;
              const data = categoryDataMap.get(tab.id);
              const count = (data?.entries.length || 0) + (data?.participants.length || 0);
              // Deduplicate count
              const uniqueIds = new Set<string>();
              data?.entries.forEach(e => uniqueIds.add(e.userId || e.participantId));
              data?.participants.forEach(p => uniqueIds.add(p.userId || p.id));

              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  onPress={() => setSelectedCategoryId(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {tab.name}
                  </Text>
                  <Text style={[styles.categoryTabCount, isActive && styles.categoryTabCountActive]}>
                    {uniqueIds.size}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Selected Category Leaderboard */}
          {selectedCategoryId && categoryDataMap.has(selectedCategoryId) && (
            <CategorySection
              key={selectedCategoryId}
              category={
                categories.find(c => c.id === selectedCategoryId) ||
                { id: '__uncategorized__', name: t.competition?.general || 'כללי', order: 999 }
              }
              categoryEntries={categoryDataMap.get(selectedCategoryId)!.entries}
              categoryParticipants={categoryDataMap.get(selectedCategoryId)!.participants}
              currentUserId={currentUserId}
              onParticipantPress={onParticipantPress}
              onParticipantLongPress={
                isAdmin
                  ? (pid, name) =>
                      setHistoryTarget({ participantId: pid, name })
                  : undefined
              }
              theme={theme}
              t={t}
              styles={styles}
              isZoneTop={isZoneTop}
            />
          )}
        </>
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

          {allEntriesNoCategory.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t.competition.noResultsYet}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
      {historyTarget && (
        <ResultHistoryModal
          visible={true}
          onClose={() => setHistoryTarget(null)}
          competitionId={competition.id}
          participantId={historyTarget.participantId}
          participantName={historyTarget.name}
        />
      )}
    </>
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
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      marginHorizontal: 15,
      marginBottom: 12,
    },
    exportButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
      marginStart: 8,
    },
    exportButtonIcon: {
      fontSize: 16,
      color: '#fff',
    },
    categoryTabs: {
      flexDirection: 'row',
      paddingVertical: 10,
      backgroundColor: theme.surface,
      marginBottom: 10,
      maxHeight: 60,
    },
    categoryTabsContent: {
      paddingHorizontal: 15,
    },
    categoryTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginEnd: 8,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
    categoryTabCount: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 10,
      overflow: 'hidden',
    },
    categoryTabCountActive: {
      color: '#fff',
      backgroundColor: 'rgba(255,255,255,0.25)',
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
    tieHintText: {
      fontSize: 11,
      color: theme.primary,
      marginTop: 2,
      fontWeight: '600',
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
