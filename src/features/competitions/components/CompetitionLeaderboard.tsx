/**
 * @fileoverview Competition Leaderboard Component
 * @description Displays competition rankings with category filter
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/features/theme/ThemeContext';
import {
  useCompetitionLeaderboard,
  useParticipants,
} from '@/features/competitions/hooks/useCompetition';
import {
  Competition,
  LeaderboardEntry,
  Category,
} from '@/features/competitions/types';
import { ParticipantService } from '@/features/competitions/services/ParticipantService';
import { formatPoints } from '@/features/competitions/constants';

// Default avatar
import defaultAvatar from '@/assets/splash.png';

interface CompetitionLeaderboardProps {
  competition: Competition;
  currentUserId?: string;
  onParticipantPress?: (participantId: string) => void;
}

export function CompetitionLeaderboard({
  competition,
  currentUserId,
  onParticipantPress,
}: CompetitionLeaderboardProps) {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch categories
  React.useEffect(() => {
    ParticipantService.getCategories(competition.id).then(setCategories);
  }, [competition.id]);

  // Get leaderboard data
  const { entries, loading, error } = useCompetitionLeaderboard(
    competition.id,
    selectedCategory
  );

  const { count: participantCount } = useParticipants(competition.id);

  const styles = createStyles(theme);

  // Top 3 for podium
  const topThree = useMemo(() => entries.slice(0, 3), [entries]);
  
  // Rest of entries (4th place onwards)
  const restOfEntries = useMemo(() => entries.slice(3), [entries]);

  const renderCategoryTabs = () => {
    if (!competition.settings.enableCategories || categories.length === 0) {
      return null;
    }

    return (
      <View style={styles.categoryTabs}>
        <TouchableOpacity
          style={[
            styles.categoryTab,
            !selectedCategory && styles.categoryTabActive,
          ]}
          onPress={() => setSelectedCategory(undefined)}
        >
          <Text
            style={[
              styles.categoryTabText,
              !selectedCategory && styles.categoryTabTextActive,
            ]}
          >
            כללי
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryTab,
              selectedCategory === cat.id && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === cat.id && styles.categoryTabTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
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
                <View style={styles.podiumAvatar}>
                  <Text style={styles.podiumAvatarText}>
                    {entry.participantName.charAt(0)}
                  </Text>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.participantName}
                </Text>
                <Text style={styles.podiumPoints}>
                  {formatPoints(entry.points)}
                </Text>
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

    return (
      <TouchableOpacity
        style={[styles.listItem, isCurrentUser && styles.currentUserItem]}
        onPress={() => onParticipantPress?.(item.participantId)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rankNumber}>{item.rank}</Text>
        </View>

        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.participantName.charAt(0)}
          </Text>
        </View>

        <View style={styles.infoContainer}>
          <Text
            style={[styles.nameText, isCurrentUser && styles.currentUserName]}
            numberOfLines={1}
          >
            {item.participantName}
            {isCurrentUser && <Text> (אתה)</Text>}
          </Text>
          <Text style={styles.statsText}>
            {item.routesCompleted} מסלולים | {formatPoints(item.points)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>טוען לידרבורד...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>שגיאה בטעינת הלידרבורד</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Competition Stats */}
      <View style={styles.statsHeader}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{participantCount}</Text>
          <Text style={styles.statLabel}>משתתפים</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {competition.settings.maxRoutes}
          </Text>
          <Text style={styles.statLabel}>מסלולים</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>TOP{competition.settings.topRoutesForScoring}</Text>
          <Text style={styles.statLabel}>ניקוד</Text>
        </View>
      </View>

      {/* Category Tabs */}
      {renderCategoryTabs()}

      {/* Podium */}
      {renderPodium()}

      {/* Rest of the list */}
      {restOfEntries.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>שאר המקומות</Text>
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
            עדיין אין תוצאות להצגה
          </Text>
        </View>
      )}
    </View>
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
      marginRight: 8,
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
      textAlign: 'right',
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
    rankContainer: {
      width: 36,
      alignItems: 'center',
    },
    rankNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
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
      textAlign: 'right',
      marginBottom: 2,
    },
    currentUserName: {
      color: theme.primary,
    },
    statsText: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
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
  });

export default CompetitionLeaderboard;
