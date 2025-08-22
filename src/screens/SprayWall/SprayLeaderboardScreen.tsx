import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sprayApi } from '@/features/spraywall/sprayApi';

const SprayLeaderboardScreen = ({ navigation, route }) => {
  const { wallId, seasonId } = route.params;
  const [selectedPeriod, setSelectedPeriod] = useState('current'); // 'current' or 'alltime'
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedPeriod]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      if (selectedPeriod === 'current' && seasonId) {
        const data = await sprayApi.getLeaderboard(wallId, seasonId);
        setLeaderboardData(data);
      } else if (selectedPeriod === 'alltime') {
        // For now, show message that all-time is not implemented
        setLeaderboardData([]);
        setError('All-time leaderboard will be implemented in the future');
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const isTopThree = index < 3;
    const medals = ['🥇', '🥈', '🥉'];
    
    return (
      <View style={[styles.leaderboardItem, isTopThree && styles.topThreeItem]}>
        <View style={styles.rankContainer}>
          {isTopThree ? (
            <Text style={styles.medal}>{medals[index]}</Text>
          ) : (
            <Text style={styles.rank}>#{index + 1}</Text>
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isTopThree && styles.topThreeText]}>
            {item.userName || 'Unknown User'}
          </Text>
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={[styles.sendCount, isTopThree && styles.topThreeText]}>
            {item.count}
          </Text>
          <Text style={styles.sendLabel}>
            {item.count === 1 ? 'send' : 'sends'}
          </Text>
        </View>
      </View>
    );
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      <TouchableOpacity
        style={[
          styles.periodButton,
          selectedPeriod === 'current' && styles.activePeriodButton,
        ]}
        onPress={() => setSelectedPeriod('current')}
      >
        <Text
          style={[
            styles.periodText,
            selectedPeriod === 'current' && styles.activePeriodText,
          ]}
        >
          This Season
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.periodButton,
          selectedPeriod === 'alltime' && styles.activePeriodButton,
        ]}
        onPress={() => setSelectedPeriod('alltime')}
      >
        <Text
          style={[
            styles.periodText,
            selectedPeriod === 'alltime' && styles.activePeriodText,
          ]}
        >
          All Time
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="trophy-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Sends Yet</Text>
      <Text style={styles.emptySubtitle}>
        {selectedPeriod === 'current'
          ? 'Be the first to send a route this season!'
          : 'All-time leaderboard coming soon'}
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadLeaderboard}>
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderPeriodSelector()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      ) : error ? (
        renderError()
      ) : leaderboardData.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={leaderboardData}
          renderItem={renderLeaderboardItem}
          keyExtractor={(item, index) => `${item.userId}-${index}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activePeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodText: {
    fontSize: 16,
    color: '#666',
  },
  activePeriodText: {
    color: 'white',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  topThreeItem: {
    backgroundColor: '#fff9e6',
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  medal: {
    fontSize: 24,
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  topThreeText: {
    color: '#b8860b',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  sendCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  sendLabel: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
  },
});

export default SprayLeaderboardScreen;
