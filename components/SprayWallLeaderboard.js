import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getSprayWallLeaderboard } from '../services/sprayWallService';
import defaultAvatar from '../assets/default-avatar.png';

export default function SprayWallLeaderboard({ 
  sprayWallId, 
  timeframe = 'current', 
  compact = false 
}) {
  const { theme } = useTheme();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const styles = createStyles(theme);

  useEffect(() => {
    loadLeaderboard();
  }, [sprayWallId, timeframe]);

  const loadLeaderboard = async () => {
    if (!sprayWallId) return;
    
    setLoading(true);
    try {
      const data = await getSprayWallLeaderboard(sprayWallId, timeframe);
      setLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const position = index + 1;
    const positionEmoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
    
    return (
      <View style={[
        styles.leaderboardItem,
        position <= 3 && styles.topThreeItem
      ]}>
        <View style={styles.positionContainer}>
          <Text style={[
            styles.position,
            position <= 3 && styles.topThreePosition
          ]}>
            {positionEmoji}
          </Text>
        </View>

        <Image
          source={item.avatar ? { uri: item.avatar } : defaultAvatar}
          style={styles.avatar}
        />

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.displayName || 'משתמש'}
          </Text>
          <Text style={styles.userStats}>
            {item.completedRoutes} מסלולים • {item.totalPoints} נקודות
          </Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.totalScore}>{item.totalPoints}</Text>
          <Text style={styles.scoreLabel}>נקודות</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={styles.loadingText}>טוען לידרבורד...</Text>
      </View>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>עדיין אין נתונים בלידרבורד</Text>
        <Text style={styles.emptySubtext}>היה הראשון לסיים מסלול!</Text>
      </View>
    );
  }

  const displayData = compact ? leaderboard.slice(0, 5) : leaderboard;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 לידרבורד</Text>
        <Text style={styles.subtitle}>
          {timeframe === 'current' ? 'הספריי הנוכחי' : 'כל הזמנים'}
        </Text>
      </View>

      <FlatList
        data={displayData}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item) => item.userId}
        scrollEnabled={!compact}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {compact && leaderboard.length > 5 && (
        <Text style={styles.moreText}>ועוד {leaderboard.length - 5} משתמשים...</Text>
      )}
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: theme.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.background,
    borderRadius: 8,
  },
  topThreeItem: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  positionContainer: {
    width: 40,
    alignItems: 'center',
  },
  position: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  topThreePosition: {
    fontSize: 18,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 12,
    backgroundColor: theme.border,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
    textAlign: 'right',
  },
  userStats: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'right',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primary,
  },
  scoreLabel: {
    fontSize: 10,
    color: theme.textSecondary,
  },
  separator: {
    height: 8,
  },
  moreText: {
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
