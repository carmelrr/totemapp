import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  FlatList,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { auth, db } from '../firebase-config';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import SprayWallLeaderboard from '../components/SprayWallLeaderboard';
import SprayRouteItem from '../components/SprayRouteItem';
import { getSprayWallRoutes, getCurrentSprayWall } from '../services/sprayWallService';

const { width: screenWidth } = Dimensions.get('window');

export default function SprayWallScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { isAdmin } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [currentSprayWall, setCurrentSprayWall] = useState(null);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState('current'); // 'current' | 'all'
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    grade: 'all',
    style: 'all',
    creator: 'all'
  });
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'grade' | 'popular'

  const styles = createStyles(theme);

  useEffect(() => {
    loadCurrentSprayWall();
    loadSprayRoutes();
  }, []);

  const loadCurrentSprayWall = async () => {
    try {
      const sprayWall = await getCurrentSprayWall();
      setCurrentSprayWall(sprayWall);
    } catch (error) {
      console.error('Error loading spray wall:', error);
    }
  };

  const loadSprayRoutes = async () => {
    try {
      const sprayRoutes = await getSprayWallRoutes();
      setRoutes(sprayRoutes);
    } catch (error) {
      console.error('Error loading spray routes:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCurrentSprayWall(), loadSprayRoutes()]);
    setRefreshing(false);
  };

  const handleAddRoute = () => {
    if (!currentSprayWall) {
      Alert.alert('שגיאה', 'לא נמצא קיר ספריי פעיל');
      return;
    }
    navigation.navigate('AddSprayRouteScreen', { 
      sprayWallId: currentSprayWall.id,
      sprayWallImage: currentSprayWall.imageUrl 
    });
  };

  const handleUploadNewWall = () => {
    Alert.alert(
      'העלאת קיר ספריי חדש',
      'העלאת קיר חדש תאפס את הלידרבורד הקיים ותתחיל עונת ספריי חדשה. האם להמשיך?',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'המשך', 
          style: 'destructive',
          onPress: () => navigation.navigate('UploadSprayWallScreen')
        }
      ]
    );
  };

  const filteredAndSortedRoutes = React.useMemo(() => {
    let filtered = routes;

    // Apply filters
    if (filters.grade !== 'all') {
      filtered = filtered.filter(route => route.grade.startsWith(filters.grade));
    }
    if (filters.style !== 'all') {
      filtered = filtered.filter(route => route.style === filters.style);
    }
    if (filters.creator !== 'all') {
      filtered = filtered.filter(route => route.creatorId === filters.creator);
    }

    // Apply sorting
    switch (sortBy) {
      case 'grade':
        filtered.sort((a, b) => {
          const gradeA = parseGradeToNumber(a.grade);
          const gradeB = parseGradeToNumber(b.grade);
          return gradeA - gradeB;
        });
        break;
      case 'popular':
        filtered.sort((a, b) => (b.attempts?.length || 0) - (a.attempts?.length || 0));
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    return filtered;
  }, [routes, filters, sortBy]);

  const parseGradeToNumber = (grade) => {
    if (grade.startsWith('V')) {
      return parseInt(grade.slice(1));
    }
    // Handle French grades for endurance routes
    const frenchGrades = {
      '6a': 10, '6a+': 11, '6b': 12, '6b+': 13,
      '6c': 14, '6c+': 15, '7a': 16, '7a+': 17,
      '7b': 18, '7b+': 19, '7c': 20, '7c+': 21,
    };
    return frenchGrades[grade] || 0;
  };

  const renderRouteItem = ({ item }) => (
    <SprayRouteItem 
      route={item} 
      onPress={() => navigation.navigate('SprayRouteDetailScreen', { routeId: item.id })}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ספריי וול</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={handleUploadNewWall}
          >
            <Text style={styles.adminButtonText}>📸 העלה קיר חדש</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Leaderboard Component */}
        <TouchableOpacity
          style={styles.leaderboardContainer}
          onPress={() => setShowLeaderboardModal(true)}
        >
          <SprayWallLeaderboard
            sprayWallId={currentSprayWall?.id}
            timeframe={leaderboardTimeframe}
            compact={true}
          />
          <Text style={styles.leaderboardTap}>👆 לחץ לצפייה מלאה</Text>
        </TouchableOpacity>

        {/* Add Route Button */}
        <TouchableOpacity
          style={styles.addRouteButton}
          onPress={handleAddRoute}
        >
          <Text style={styles.addRouteButtonText}>➕ הוסף מסלול</Text>
        </TouchableOpacity>

        {/* Filter and Sort Buttons */}
        <View style={styles.filterSortContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={styles.filterButtonText}>🔍 סינון</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const nextSort = sortBy === 'newest' ? 'grade' : 
                              sortBy === 'grade' ? 'popular' : 'newest';
              setSortBy(nextSort);
            }}
          >
            <Text style={styles.sortButtonText}>
              📊 {sortBy === 'newest' ? 'חדש ביותר' : 
                   sortBy === 'grade' ? 'לפי דירוג' : 'פופולרי'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Routes List */}
        <View style={styles.routesContainer}>
          <Text style={styles.routesTitle}>מסלולי ספריי ({filteredAndSortedRoutes.length})</Text>
          <FlatList
            data={filteredAndSortedRoutes}
            renderItem={renderRouteItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>אין מסלולים להצגה</Text>
                <Text style={styles.emptySubtext}>היה הראשון להוסיף מסלול!</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>

      {/* Leaderboard Modal */}
      <Modal
        visible={showLeaderboardModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>לידרבורד ספריי וול</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowLeaderboardModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timeframeSelector}>
            <TouchableOpacity
              style={[
                styles.timeframeButton,
                leaderboardTimeframe === 'current' && styles.timeframeButtonActive
              ]}
              onPress={() => setLeaderboardTimeframe('current')}
            >
              <Text style={[
                styles.timeframeButtonText,
                leaderboardTimeframe === 'current' && styles.timeframeButtonTextActive
              ]}>
                📆 הספריי הנוכחי
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.timeframeButton,
                leaderboardTimeframe === 'all' && styles.timeframeButtonActive
              ]}
              onPress={() => setLeaderboardTimeframe('all')}
            >
              <Text style={[
                styles.timeframeButtonText,
                leaderboardTimeframe === 'all' && styles.timeframeButtonTextActive
              ]}>
                ⏱️ כל הזמנים
              </Text>
            </TouchableOpacity>
          </View>

          <SprayWallLeaderboard
            sprayWallId={currentSprayWall?.id}
            timeframe={leaderboardTimeframe}
            compact={false}
          />
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.surface,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    flex: 1,
  },
  adminButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adminButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  leaderboardContainer: {
    margin: 20,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  leaderboardTap: {
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  addRouteButton: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addRouteButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterSortContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    backgroundColor: theme.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sortButton: {
    flex: 1,
    backgroundColor: theme.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  sortButtonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  routesContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  routesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: 'bold',
  },
  timeframeSelector: {
    flexDirection: 'row',
    margin: 20,
    gap: 10,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  timeframeButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  timeframeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  timeframeButtonTextActive: {
    color: '#ffffff',
  },
});
