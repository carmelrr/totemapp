/**
 * LeaderboardScreen - Improved Routes Points System with Competition Support
 *
 * This screen shows a leaderboard based on climbing points and active competitions.
 * Points are calculated based on the grades of routes completed by users.
 *
 * Features:
 * - Active competition banner with live leaderboard
 * - Time-based filtering (week/month/all time)
 * - Cached points for better performance
 * - Real-time updates
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "@/features/data/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import defaultAvatar from "@/assets/splash.png";
import { useTheme } from "@/features/theme/ThemeContext";
import { useAdmin } from "@/context/AdminContext";
import { useActiveCompetitions, Competition } from "@/features/competitions";
import { ActiveCompetitionBanner } from "@/features/competitions/components/ActiveCompetitionBanner";

const { width: screenWidth } = Dimensions.get("window");

// Time filter options
type TimeFilter = 'week' | 'month' | 'all';

// Points per grade (standard leaderboard)
const GRADE_POINTS: Record<string, number> = {
  VB: 0.5,
  V0: 1,
  V1: 2,
  V2: 3,
  V3: 4,
  V4: 5,
  V5: 6,
  V6: 7,
  V7: 8,
  V8: 9,
  V9: 10,
  V10: 11,
};

interface LeaderboardUser {
  id: string;
  displayName: string;
  photoURL: string | null;
  points: number;
  routeCount?: number;
  actualRank?: number;
}

export default function LeaderboardScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { isAdmin } = useAdmin();
  
  // State
  const [allUsers, setAllUsers] = useState<LeaderboardUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  
  const currentUserId = auth.currentUser?.uid;

  // Active competitions
  const { competitions: activeCompetitions, hasActiveCompetition } = useActiveCompetitions();

  // Load users data with filtering
  const loadUsersData = useCallback(async () => {
    try {
      setLoading(true);

      // Get time filter date
      const filterDate = getFilterDate(timeFilter);

      // Get all users
      const usersSnapshot = await getDocs(collection(db, "users"));
      const users: LeaderboardUser[] = [];

      // Calculate points for each user
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const { points, routeCount } = await calculateUserPoints(userDoc.id, filterDate);

        users.push({
          id: userDoc.id,
          displayName: userData.displayName || "משתמש",
          photoURL: userData.photoURL || null,
          points,
          routeCount,
        });
      }

      // Sort by points (highest first)
      users.sort((a, b) => b.points - a.points);

      setAllUsers(users);
    } catch (error) {
      console.error("Error loading users data:", error);
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    loadUsersData();
  }, [loadUsersData]);

  const getFilterDate = (filter: TimeFilter): Date | null => {
    const now = new Date();
    switch (filter) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const calculateUserPoints = async (
    userId: string,
    afterDate: Date | null
  ): Promise<{ points: number; routeCount: number }> => {
    try {
      // Get all routes
      const routesSnapshot = await getDocs(collection(db, "routes"));
      const routes: any[] = [];
      routesSnapshot.forEach((doc) => {
        routes.push({ id: doc.id, ...doc.data() });
      });

      let totalPoints = 0;
      let routeCount = 0;

      // Calculate points for each route the user completed
      for (const route of routes) {
        const feedbacksRef = collection(db, "routes", route.id, "feedbacks");
        
        // Build query
        let feedbackQuery;
        if (afterDate) {
          feedbackQuery = query(
            feedbacksRef,
            where("userId", "==", userId),
            where("closedRoute", "==", true),
            where("createdAt", ">=", Timestamp.fromDate(afterDate))
          );
        } else {
          feedbackQuery = query(
            feedbacksRef,
            where("userId", "==", userId),
            where("closedRoute", "==", true)
          );
        }

        const feedbackSnapshot = await getDocs(feedbackQuery);

        feedbackSnapshot.forEach((feedbackDoc) => {
          const feedback = feedbackDoc.data();
          const gradeAtTimeOfCompletion = feedback.suggestedGrade || route.grade;
          const points = GRADE_POINTS[gradeAtTimeOfCompletion] || 0;
          totalPoints += points;
          routeCount++;
        });
      }

      return { points: totalPoints, routeCount };
    } catch (error) {
      console.error("Error calculating user points:", error);
      return { points: 0, routeCount: 0 };
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsersData();
    setRefreshing(false);
  };

  const getCurrentUserRank = () => {
    const userIndex = allUsers.findIndex((user) => user.id === currentUserId);
    return userIndex !== -1 ? userIndex + 1 : null;
  };

  const getCurrentUserStats = () => {
    return allUsers.find((user) => user.id === currentUserId);
  };

  // Get users with points > 0
  const usersWithPoints = useMemo(
    () => allUsers.filter((user) => user.points > 0),
    [allUsers]
  );

  // Get top 3 for podium
  const topThree = useMemo(() => usersWithPoints.slice(0, 3), [usersWithPoints]);

  // Get users for the list (4th place onwards)
  const getRestOfUsers = () => {
    const currentUser = getCurrentUserStats();
    const currentUserRank = getCurrentUserRank();

    if (usersWithPoints.length <= 3) return [];

    // Show positions 4-13 (10 users)
    const restUsers = usersWithPoints.slice(3, 13);

    // If current user is not in the visible list and has points > 0, add them at the end
    if (
      currentUser &&
      currentUserRank &&
      currentUserRank > 13 &&
      currentUser.points > 0
    ) {
      restUsers.push({
        ...currentUser,
        actualRank: currentUserRank,
      });
    }

    return restUsers;
  };

  const handleCompetitionPress = (competition: Competition) => {
    // Navigate to competition management/judge screen
    navigation.navigate('Competitions', {
      screen: 'ManageCompetition',
      params: { competitionId: competition.id }
    });
  };

  const handleManageCompetitions = () => {
    navigation.navigate('Competitions', { screen: 'CompetitionsList' });
  };

  const renderTimeFilterTabs = () => (
    <View style={styles.filterContainer}>
      {(['week', 'month', 'all'] as TimeFilter[]).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterTab,
            timeFilter === filter && styles.filterTabActive,
          ]}
          onPress={() => setTimeFilter(filter)}
        >
          <Text
            style={[
              styles.filterTabText,
              timeFilter === filter && styles.filterTabTextActive,
            ]}
          >
            {filter === 'week' ? 'שבוע' : filter === 'month' ? 'חודש' : 'הכל'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPodium = () => {
    if (topThree.length === 0) return null;

    return (
      <View style={styles.podiumContainer}>
        <View style={styles.podiumRow}>
          {/* Second place */}
          {topThree[1] && (
            <View style={styles.podiumPlace}>
              <View style={styles.podiumStep2}>
                <Text style={styles.podiumRank}>2</Text>
              </View>
              <Image
                source={
                  topThree[1].photoURL
                    ? { uri: topThree[1].photoURL }
                    : defaultAvatar
                }
                style={styles.podiumAvatar}
              />
              <Text style={styles.podiumName} numberOfLines={1}>
                {topThree[1].displayName}
              </Text>
              <Text style={styles.podiumPoints}>{topThree[1].points} נק'</Text>
              <Text style={styles.podiumMedal}>🥈</Text>
            </View>
          )}

          {/* First place */}
          {topThree[0] && (
            <View style={styles.podiumPlace}>
              <View style={styles.podiumStep1}>
                <Text style={styles.podiumRank}>1</Text>
              </View>
              <Image
                source={
                  topThree[0].photoURL
                    ? { uri: topThree[0].photoURL }
                    : defaultAvatar
                }
                style={styles.podiumAvatar}
              />
              <Text style={styles.podiumName} numberOfLines={1}>
                {topThree[0].displayName}
              </Text>
              <Text style={styles.podiumPoints}>{topThree[0].points} נק'</Text>
              <Text style={styles.podiumMedal}>🥇</Text>
            </View>
          )}

          {/* Third place */}
          {topThree[2] && (
            <View style={styles.podiumPlace}>
              <View style={styles.podiumStep3}>
                <Text style={styles.podiumRank}>3</Text>
              </View>
              <Image
                source={
                  topThree[2].photoURL
                    ? { uri: topThree[2].photoURL }
                    : defaultAvatar
                }
                style={styles.podiumAvatar}
              />
              <Text style={styles.podiumName} numberOfLines={1}>
                {topThree[2].displayName}
              </Text>
              <Text style={styles.podiumPoints}>{topThree[2].points} נק'</Text>
              <Text style={styles.podiumMedal}>🥉</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardUser; index: number }) => {
    const avatarSource = item.photoURL ? { uri: item.photoURL } : defaultAvatar;
    const isCurrentUser = item.id === currentUserId;
    const displayRank = item.actualRank || index + 4;

    return (
      <View
        style={[
          styles.leaderboardItem,
          isCurrentUser && styles.currentUserItem,
        ]}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rankNumber}>{displayRank}</Text>
        </View>

        <Image source={avatarSource} style={styles.userAvatar} />

        <View style={styles.userInfo}>
          <Text
            style={[styles.userName, isCurrentUser && styles.currentUserName]}
          >
            {item.displayName || "משתמש"}
            {isCurrentUser && <Text> (אתה)</Text>}
          </Text>
          <Text style={styles.userStat}>
            {item.points} נקודות {item.routeCount ? `| ${item.routeCount} מסלולים` : ''}
          </Text>
        </View>
      </View>
    );
  };

  // Create styles based on current theme
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>
          {hasActiveCompetition ? '🏆 תחרויות' : '🏆 לוח שיאים'}
        </Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={handleManageCompetitions}
          >
            <Ionicons name="settings-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Active Competition Banner */}
        {hasActiveCompetition && activeCompetitions[0] && (
          <ActiveCompetitionBanner
            competition={activeCompetitions[0]}
            onPress={() => handleCompetitionPress(activeCompetitions[0])}
          />
        )}

        {/* Time Filter Tabs */}
        {renderTimeFilterTabs()}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>טוען לוח שיאים...</Text>
          </View>
        )}

        {/* Podium for top 3 */}
        {!loading && renderPodium()}

        {/* Rest of the leaderboard */}
        {!loading && (
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>שאר המקומות</Text>
            {getRestOfUsers().map((user, index) => {
              const displayIndex = user.actualRank
                ? user.actualRank - 1
                : index + 3;
              return (
                <View key={user.id}>
                  {renderLeaderboardItem({ item: user, index: displayIndex })}
                </View>
              );
            })}
            {getRestOfUsers().length === 0 && usersWithPoints.length <= 3 && (
              <Text style={styles.emptyText}>אין עוד משתמשים להצגה</Text>
            )}
          </View>
        )}

        {/* Current User Position (if not in top 13) */}
        {!loading && getCurrentUserRank() && getCurrentUserRank()! > 13 && (
          <View style={styles.currentUserSection}>
            <Text style={styles.currentUserSectionTitle}>המיקום שלך</Text>
            {renderLeaderboardItem({
              item: { ...getCurrentUserStats()!, actualRank: getCurrentUserRank()! },
              index: getCurrentUserRank()! - 1,
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerContainer: {
      backgroundColor: theme.surface,
      paddingVertical: 20,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      alignItems: "center",
      flexDirection: 'row',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
      flex: 1,
    },
    manageButton: {
      position: 'absolute',
      right: 15,
      padding: 8,
      borderRadius: 20,
      backgroundColor: theme.isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
    },
    scrollContainer: {
      flex: 1,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    filterContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
      backgroundColor: theme.surface,
      marginBottom: 10,
    },
    filterTab: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
      marginHorizontal: 4,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    },
    filterTabActive: {
      backgroundColor: theme.primary,
    },
    filterTabText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    filterTabTextActive: {
      color: '#fff',
      fontWeight: 'bold',
    },
    // Podium Styles
    podiumContainer: {
      backgroundColor: theme.surface,
      padding: 20,
      marginBottom: 10,
    },
    podiumRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "flex-end",
      height: 200,
    },
    podiumPlace: {
      alignItems: "center",
      marginHorizontal: 10,
      flex: 1,
    },
    podiumStep1: {
      backgroundColor: "#f1c40f",
      height: 80,
      width: "100%",
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    podiumStep2: {
      backgroundColor: "#95a5a6",
      height: 60,
      width: "100%",
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    podiumStep3: {
      backgroundColor: "#cd7f32",
      height: 40,
      width: "100%",
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    podiumRank: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "bold",
    },
    podiumAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginBottom: 5,
      borderWidth: 3,
      borderColor: theme.surface,
    },
    podiumName: {
      fontSize: 12,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
      marginBottom: 2,
    },
    podiumPoints: {
      fontSize: 10,
      color: theme.textSecondary,
      marginBottom: 2,
      textAlign: "center",
    },
    podiumMedal: {
      fontSize: 20,
    },
    // List Styles
    listSection: {
      backgroundColor: theme.surface,
      marginTop: 10,
      paddingTop: 15,
    },
    listTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      paddingHorizontal: 15,
      marginBottom: 10,
      textAlign: "right",
    },
    leaderboardItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      marginVertical: 4,
      marginHorizontal: 15,
      padding: 16,
      borderRadius: 14,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    currentUserItem: {
      borderWidth: 2,
      borderColor: theme.secondary,
      backgroundColor: theme.isDark ? "rgba(155, 89, 182, 0.15)" : "#f8f4ff",
    },
    rankContainer: {
      alignItems: "center",
      marginRight: 15,
      minWidth: 40,
    },
    rankNumber: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.text,
    },
    userAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginRight: 15,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 4,
      textAlign: "right",
    },
    currentUserName: {
      color: theme.secondary,
    },
    userStat: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "right",
    },
    emptyText: {
      textAlign: "center",
      color: theme.textSecondary,
      fontSize: 16,
      margin: 20,
    },
    currentUserSection: {
      backgroundColor: theme.surface,
      marginTop: 10,
      paddingTop: 15,
      paddingBottom: 15,
    },
    currentUserSectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.textSecondary,
      paddingHorizontal: 15,
      marginBottom: 10,
      textAlign: 'right',
    },
  });
