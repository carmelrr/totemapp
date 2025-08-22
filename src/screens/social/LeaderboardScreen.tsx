/*
 * LeaderboardScreen - Routes Points System
 *
 * This screen shows a leaderboard based on climbing points.
 * Points are calculated based on the grades of routes completed by users.
 *
 * Important: Points are calculated based on the grade the user suggested
 * when they completed the route (suggestedGrade in feedback), not the
 * current grade of the route. This ensures fair scoring even if routes
 * are re-graded later.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  ScrollView,
} from "react-native";
import { auth, db } from "@/features/data/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import defaultAvatar from "@/assets/default-avatar.png";
import { useTheme } from "@/features/theme/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

export default function LeaderboardScreen() {
  const { theme } = useTheme();
  const [allUsers, setAllUsers] = useState([]); // כל המשתמשים
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadUsersData();
  }, []);

  const calculateUserPoints = async (userId) => {
    try {
      // Get all routes from the wall
      const routesSnapshot = await getDocs(collection(db, "routes"));
      const routes = [];
      routesSnapshot.forEach((doc) => {
        routes.push({ id: doc.id, ...doc.data() });
      });

      let totalPoints = 0;

      // Calculate points for each route the user completed
      for (const route of routes) {
        const feedbacksRef = collection(db, "routes", route.id, "feedbacks");
        const userFeedbackQuery = query(
          feedbacksRef,
          where("userId", "==", userId),
          where("closedRoute", "==", true),
        );
        const userFeedbackSnapshot = await getDocs(userFeedbackQuery);

        userFeedbackSnapshot.forEach((feedbackDoc) => {
          const feedback = feedbackDoc.data();
          // Use the grade that the user suggested when they closed the route
          // This represents the difficulty they climbed at that time
          const gradeAtTimeOfCompletion =
            feedback.suggestedGrade || route.grade;
          const points = getPointsForGrade(gradeAtTimeOfCompletion);
          totalPoints += points;
        });
      }

      return totalPoints;
    } catch (error) {
      console.error("Error calculating user points:", error);
      return 0;
    }
  };

  const getPointsForGrade = (grade) => {
    const gradePoints = {
      V1: 1,
      V2: 2,
      V3: 3,
      V4: 4,
      V5: 5,
      V6: 6,
      V7: 7,
      V8: 8,
      V9: 9,
      V10: 10,
    };

    return gradePoints[grade] || 0;
  };

  const loadUsersData = async () => {
    try {
      // Get all users
      const usersSnapshot = await getDocs(collection(db, "users"));
      const users = [];

      // Calculate points for each user
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const points = await calculateUserPoints(userDoc.id);

        // Include all users, even with 0 points
        users.push({
          id: userDoc.id,
          displayName: userData.displayName || "משתמש",
          photoURL: userData.photoURL,
          points: points,
        });
      }

      // Sort by points (highest first)
      users.sort((a, b) => b.points - a.points);

      setAllUsers(users);
    } catch (error) {
      console.error("Error loading users data:", error);
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
    const user = allUsers.find((user) => user.id === currentUserId);
    return user;
  };

  // Get top 3 for podium
  const getTopThree = () => {
    return allUsers.filter((user) => user.points > 0).slice(0, 3);
  };

  // Get users for the list (4th place onwards, limited to show)
  const getRestOfUsers = () => {
    const usersWithPoints = allUsers.filter((user) => user.points > 0);
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
        actualRank: currentUserRank, // Store the real rank
      });
    }

    return restUsers;
  };

  const renderPodium = () => {
    const topThree = getTopThree();
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
              <Text style={styles.podiumName}>{topThree[1].displayName}</Text>
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
              <Text style={styles.podiumName}>{topThree[0].displayName}</Text>
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
              <Text style={styles.podiumName}>{topThree[2].displayName}</Text>
              <Text style={styles.podiumPoints}>{topThree[2].points} נק'</Text>
              <Text style={styles.podiumMedal}>🥉</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const avatarSource = item.photoURL ? { uri: item.photoURL } : defaultAvatar;
    const isCurrentUser = item.id === currentUserId;

    // Check if this is the current user shown at the bottom with their real rank
    const displayRank = item.actualRank || index + 4; // Start from 4th place

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
          <Text style={styles.userStat}>{item.points} נקודות</Text>
        </View>
      </View>
    );
  };

  // Create styles based on current theme
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>🏆 לוח מובילים</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Podium for top 3 */}
        {renderPodium()}

        {/* Rest of the leaderboard */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>שאר המקומות</Text>
          {getRestOfUsers().map((user, index) => {
            const displayIndex = user.actualRank
              ? user.actualRank - 1
              : index + 3; // For the renderLeaderboardItem
            return (
              <View key={user.id}>
                {renderLeaderboardItem({ item: user, index: displayIndex })}
              </View>
            );
          })}
          {getRestOfUsers().length === 0 && (
            <Text style={styles.emptyText}>אין עוד משתמשים להצגה</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) =>
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
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#2c3e50",
      textAlign: "right",
    },
    scrollContainer: {
      flex: 1,
    },
    // Podium Styles
    podiumContainer: {
      backgroundColor: "#fff",
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
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    podiumStep2: {
      backgroundColor: "#95a5a6",
      height: 60,
      width: "100%",
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    podiumStep3: {
      backgroundColor: "#cd7f32",
      height: 40,
      width: "100%",
      borderRadius: 8,
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
      borderColor: "#fff",
    },
    podiumName: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#2c3e50",
      textAlign: "right",
      marginBottom: 2,
    },
    podiumPoints: {
      fontSize: 10,
      color: "#7f8c8d",
      marginBottom: 2,
      textAlign: "right",
    },
    podiumMedal: {
      fontSize: 20,
    },
    // List Styles
    listSection: {
      backgroundColor: "#fff",
      marginTop: 10,
      paddingTop: 15,
    },
    listTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#2c3e50",
      paddingHorizontal: 15,
      marginBottom: 10,
      textAlign: "right",
    },
    leaderboardItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fff",
      marginVertical: 2,
      marginHorizontal: 15,
      padding: 15,
      borderRadius: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    currentUserItem: {
      borderWidth: 2,
      borderColor: "#8e44ad",
      backgroundColor: "#f8f4ff",
    },
    rankContainer: {
      alignItems: "center",
      marginRight: 15,
      minWidth: 40,
    },
    rankNumber: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#2c3e50",
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
      color: "#2c3e50",
      marginBottom: 4,
      textAlign: "right",
    },
    currentUserName: {
      color: "#8e44ad",
    },
    userStat: {
      fontSize: 14,
      color: "#7f8c8d",
      textAlign: "right",
    },
    emptyText: {
      textAlign: "right",
      color: "#7f8c8d",
      fontSize: 16,
      margin: 20,
    },
  });
