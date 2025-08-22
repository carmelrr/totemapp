import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Dimensions,
  Modal,
  Switch,
} from "react-native";
import { auth, db } from "@/features/data/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import {
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
} from "@/features/social/socialService";
import defaultAvatar from "@/assets/default-avatar.png";
import { useTheme } from "@/features/theme/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

export default function UserProfileScreen({ route, navigation }) {
  const { userId, autoEdit = false } = route.params;
  const currentUserId = auth.currentUser?.uid;
  const { theme } = useTheme();

  const [userProfile, setUserProfile] = useState(null);
  const [userStats, setUserStats] = useState({
    totalRoutesSent: 0,
    highestGrade: "N/A",
    totalFeedbacks: 0,
    averageStarRating: 0,
    joinDate: null,
  });
  const [gradeStats, setGradeStats] = useState({});
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [allRoutes, setAllRoutes] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowed, setIsFollowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditingPrivacy, setIsEditingPrivacy] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    showTotalRoutes: true,
    showHighestGrade: true,
    showFeedbackCount: true,
    showAverageRating: true,
    showGradeStats: true,
    showJoinDate: true,
  });

  useEffect(() => {
    loadUserProfile();
  }, [userId]);

  useEffect(() => {
    // Auto-enable edit mode if requested and user is owner
    if (autoEdit && currentUserId === userId) {
      setIsEditingPrivacy(true);
    }
  }, [autoEdit, currentUserId, userId]);

  // Listen for route params changes (when navigating back to the same screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      const { autoEdit: newAutoEdit } = route.params;
      if (newAutoEdit && currentUserId === userId) {
        setIsEditingPrivacy(true);
      }
    });

    return unsubscribe;
  }, [navigation, route.params, currentUserId, userId]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUserProfile(),
        fetchUserStats(),
        calculateGradeStats(),
        checkFollowStatus(),
      ]);
    } catch (error) {
      console.error("Error loading user profile:", error);
      Alert.alert("שגיאה", "לא ניתן לטעון פרופיל משתמש");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserProfile();
    } catch (error) {
      Alert.alert("שגיאה", "נכשל ברענון הנתונים");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchUserProfile = async () => {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();
      setUserProfile(userData);

      // Load privacy settings only if it's the current user's profile
      if (userData.privacySettings && currentUserId === userId) {
        setPrivacySettings(userData.privacySettings);
      } else if (userData.privacySettings) {
        setPrivacySettings(userData.privacySettings);
      }

      // Get followers and following
      const [followersData, followingData] = await Promise.all([
        getUserFollowers(userId),
        getUserFollowing(userId),
      ]);

      setFollowers(followersData);
      setFollowing(followingData);
    }
  };

  const fetchUserStats = async () => {
    const userDoc = await getDoc(doc(db, "users", userId));

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const persistentStats = userData.stats || {};

      setUserStats({
        totalRoutesSent: persistentStats.totalRoutesSent || 0,
        highestGrade: persistentStats.highestGrade || "N/A",
        totalFeedbacks: persistentStats.totalFeedbacks || 0,
        averageStarRating: persistentStats.averageStarRating || 0,
        joinDate: userData.createdAt
          ? new Date(userData.createdAt.seconds * 1000)
          : null,
      });
    }
  };

  const calculateGradeStats = async () => {
    try {
      // Get all routes
      const routesSnapshot = await getDocs(collection(db, "routes"));
      const routes = [];
      routesSnapshot.forEach((doc) => {
        routes.push({ id: doc.id, ...doc.data() });
      });

      setAllRoutes(routes);

      // Count routes by grade
      const routesByGrade = {};
      routes.forEach((route) => {
        const grade = route.grade || "לא מוגדר";
        routesByGrade[grade] = (routesByGrade[grade] || 0) + 1;
      });

      // Count completed routes by grade for this user
      const completedByGrade = {};

      for (const route of routes) {
        const feedbacksRef = collection(db, "routes", route.id, "feedbacks");
        const userFeedbackQuery = query(
          feedbacksRef,
          where("userId", "==", userId),
          where("closedRoute", "==", true),
        );
        const userFeedbackSnapshot = await getDocs(userFeedbackQuery);

        if (!userFeedbackSnapshot.empty) {
          const grade = route.grade || "לא מוגדר";
          completedByGrade[grade] = (completedByGrade[grade] || 0) + 1;
        }
      }

      // Calculate percentages
      const stats = {};
      Object.keys(routesByGrade).forEach((grade) => {
        const total = routesByGrade[grade];
        const completed = completedByGrade[grade] || 0;
        const percentage =
          total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";

        stats[grade] = {
          total,
          completed,
          percentage: parseFloat(percentage),
        };
      });

      setGradeStats(stats);
    } catch (error) {
      console.error("Error calculating grade stats:", error);
    }
  };

  const checkFollowStatus = async () => {
    if (!currentUserId) return;

    try {
      const followersData = await getUserFollowers(userId);
      const isCurrentUserFollowing = followersData.some(
        (follower) => follower.id === currentUserId,
      );
      setIsFollowed(isCurrentUserFollowing);
    } catch (error) {
      console.error("Error checking follow status:", error);
    }
  };

  // Save privacy settings to Firestore
  const savePrivacySettings = async (newSettings) => {
    if (!currentUserId || currentUserId !== userId) return;
    try {
      await setDoc(
        doc(db, "users", userId),
        {
          privacySettings: newSettings,
        },
        { merge: true },
      );
      setPrivacySettings(newSettings);
    } catch (error) {
      console.error("Error saving privacy settings:", error);
      Alert.alert("שגיאה", "לא ניתן לשמור הגדרות פרטיות");
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUserId) return;

    try {
      if (isFollowed) {
        await unfollowUser(currentUserId, userId);
        setIsFollowed(false);
      } else {
        await followUser(currentUserId, userId);
        setIsFollowed(true);
      }

      // Refresh followers list
      const followersData = await getUserFollowers(userId);
      setFollowers(followersData);
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.alert("שגיאה", "לא ניתן לבצע פעולה");
    }
  };

  // Grade Statistics Modal Component
  const GradeStatsModal = () => {
    if (!privacySettings.showGradeStats) {
      return null;
    }

    const sortedGrades = Object.keys(gradeStats).sort((a, b) => {
      const gradeOrder = {
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
      return (gradeOrder[a] || 999) - (gradeOrder[b] || 999);
    });

    const totalRoutes = allRoutes.length;
    const totalCompleted = Object.values(gradeStats).reduce(
      (sum, stat) => sum + stat.completed,
      0,
    );
    const overallPercentage =
      totalRoutes > 0
        ? ((totalCompleted / totalRoutes) * 100).toFixed(1)
        : "0.0";

    return (
      <Modal
        visible={showStatsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📈 אחוזי סגירה לפי דירוג</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowStatsModal(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.overallStatsContainer}>
            <Text style={styles.overallStatsText}>
              סיכום כללי: {totalCompleted} מתוך {totalRoutes} מסלולים (
              {overallPercentage}%)
            </Text>
          </View>

          <ScrollView style={styles.modalContent}>
            {sortedGrades.map((grade) => {
              const stat = gradeStats[grade];
              const progressWidth = stat.percentage;

              return (
                <View key={grade} style={styles.gradeStatRow}>
                  <View style={styles.gradeStatHeader}>
                    <Text style={styles.gradeLabel}>{grade}</Text>
                    <Text style={styles.gradePercentage}>
                      {stat.percentage}%
                    </Text>
                  </View>

                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${progressWidth}%`,
                          backgroundColor:
                            progressWidth === 100
                              ? "#28a745"
                              : progressWidth >= 75
                                ? "#ffc107"
                                : progressWidth >= 50
                                  ? "#fd7e14"
                                  : progressWidth >= 25
                                    ? "#17a2b8"
                                    : "#dc3545",
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.gradeStatDetails}>
                    {stat.completed} מתוך {stat.total} מסלולים
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Statistics Cards Component
  const StatCard = ({
    title,
    value,
    icon,
    color = "#007AFF",
    onPress = null,
    isVisible = true,
    settingKey = null,
  }) => {
    const isOwner = currentUserId === userId;

    if (!isVisible && !isOwner) {
      return (
        <View
          style={[
            styles.statCard,
            styles.hiddenStatCard,
            { borderLeftColor: color },
          ]}
        >
          <View style={styles.statContent}>
            <Text style={styles.statIcon}>🔒</Text>
            <View style={styles.statTextContainer}>
              <Text style={styles.statValue}>פרטי</Text>
              <Text style={styles.statTitle}>{title}</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.statCard, { borderLeftColor: color }]}>
        <TouchableOpacity
          style={styles.statContent}
          onPress={onPress}
          disabled={!onPress}
        >
          <Text style={styles.statIcon}>{icon}</Text>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>
              {isVisible || isOwner ? value : "פרטי"}
            </Text>
            <Text style={styles.statTitle}>{title}</Text>
          </View>
          {onPress && <Text style={styles.statArrow}>›</Text>}
        </TouchableOpacity>

        {/* Privacy Toggle for Owner */}
        {isOwner && isEditingPrivacy && settingKey && (
          <View style={styles.privacyToggleContainer}>
            <Text style={styles.privacyToggleLabel}>הצג לאחרים</Text>
            <Switch
              value={privacySettings[settingKey]}
              onValueChange={(value) => {
                const newSettings = { ...privacySettings, [settingKey]: value };
                savePrivacySettings(newSettings);
              }}
              trackColor={{ false: "#ccc", true: "#27ae60" }}
              thumbColor={privacySettings[settingKey] ? "#27ae60" : "#f4f3f4"}
              style={styles.privacySwitch}
            />
          </View>
        )}
      </View>
    );
  };

  // Stats Dashboard Component
  const StatsDashboard = () => {
    const totalRoutes = allRoutes.length;
    const totalCompleted = Object.values(gradeStats).reduce(
      (sum, stat) => sum + stat.completed,
      0,
    );
    const overallPercentage =
      totalRoutes > 0
        ? ((totalCompleted / totalRoutes) * 100).toFixed(1)
        : "0.0";
    const isOwner = currentUserId === userId;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>
            📊{" "}
            {isOwner
              ? "הסטטיסטיקות שלי"
              : `הסטטיסטיקות של ${userProfile?.displayName}`}
          </Text>
          {isOwner && (
            <TouchableOpacity
              style={[
                styles.editButton,
                isEditingPrivacy && styles.editButtonActive,
              ]}
              onPress={() => setIsEditingPrivacy(!isEditingPrivacy)}
            >
              <Text
                style={[
                  styles.editButtonText,
                  isEditingPrivacy && styles.editButtonTextActive,
                ]}
              >
                {isEditingPrivacy ? "✓ סיום עריכה" : "⚙️ עריכה"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Auto-edit notification */}
        {isOwner && isEditingPrivacy && autoEdit && (
          <View style={styles.autoEditNotification}>
            <Text style={styles.autoEditText}>
              🔧 מצב עריכה פעיל - ערוך את הגדרות הפרטיות שלך
            </Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard
            title="מסלולים שסגר"
            value={userStats.totalRoutesSent}
            icon="🎯"
            color="#28a745"
            isVisible={privacySettings.showTotalRoutes}
            settingKey="showTotalRoutes"
          />

          <StatCard
            title="דירוג הכי גבוה"
            value={userStats.highestGrade}
            icon="🏆"
            color="#ffc107"
            isVisible={privacySettings.showHighestGrade}
            settingKey="showHighestGrade"
          />

          <StatCard
            title="סה״כ פידבקים"
            value={userStats.totalFeedbacks}
            icon="💬"
            color="#17a2b8"
            isVisible={privacySettings.showFeedbackCount}
            settingKey="showFeedbackCount"
          />

          <StatCard
            title="דירוג כוכבים ממוצע"
            value={userStats.averageStarRating.toFixed(1)}
            icon="⭐"
            color="#fd7e14"
            isVisible={privacySettings.showAverageRating}
            settingKey="showAverageRating"
          />

          <StatCard
            title="אחוזי סגירה לכל הקיר"
            value={`${overallPercentage}%`}
            icon="📈"
            color="#8e44ad"
            onPress={
              privacySettings.showGradeStats || isOwner
                ? () => setShowStatsModal(true)
                : null
            }
            isVisible={privacySettings.showGradeStats}
            settingKey="showGradeStats"
          />
        </View>

        {userStats.joinDate && (privacySettings.showJoinDate || isOwner) && (
          <View style={styles.joinDateContainer}>
            <View style={styles.joinDateContent}>
              <Text style={styles.joinDateText}>
                🗓️ חבר מאז: {userStats.joinDate.toLocaleDateString("he-IL")}
              </Text>
              {isOwner && isEditingPrivacy && (
                <View style={styles.joinDatePrivacy}>
                  <Text style={styles.privacyToggleLabel}>הצג לאחרים</Text>
                  <Switch
                    value={privacySettings.showJoinDate}
                    onValueChange={(value) => {
                      const newSettings = {
                        ...privacySettings,
                        showJoinDate: value,
                      };
                      savePrivacySettings(newSettings);
                    }}
                    trackColor={{ false: "#ccc", true: "#27ae60" }}
                    thumbColor={
                      privacySettings.showJoinDate ? "#27ae60" : "#f4f3f4"
                    }
                    style={styles.privacySwitch}
                  />
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8e44ad" />
        <Text style={styles.loadingText}>טוען פרופיל...</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>לא ניתן למצוא משתמש</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avatarSource = userProfile.photoURL
    ? { uri: userProfile.photoURL }
    : defaultAvatar;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#8e44ad"]}
          tintColor="#8e44ad"
        />
      }
    >
      <View style={styles.innerContainer}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image source={avatarSource} style={styles.avatar} />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {userProfile.displayName || "משתמש"}
            </Text>

            <View style={styles.followStats}>
              <Text style={styles.followStat}>{followers.length} עוקבים</Text>
              <Text style={styles.followStat}> • </Text>
              <Text style={styles.followStat}>{following.length} עוקב</Text>
            </View>

            {currentUserId !== userId && (
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowed && styles.unfollowButton,
                ]}
                onPress={handleFollowToggle}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    isFollowed && styles.unfollowButtonText,
                  ]}
                >
                  {isFollowed ? "ביטול מעקב" : "מעקב"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Dashboard */}
        <StatsDashboard />
      </View>

      {/* Grade Statistics Modal */}
      <GradeStatsModal />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#7f8c8d",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  errorText: {
    fontSize: 18,
    color: "#e74c3c",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#8e44ad",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  profileHeader: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#eee",
    borderWidth: 4,
    borderColor: "#8e44ad",
  },
  profileInfo: {
    alignItems: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
    textAlign: "center",
  },
  followStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  followStat: {
    fontSize: 16,
    color: "#7f8c8d",
    fontWeight: "500",
  },
  followButton: {
    backgroundColor: "#8e44ad",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  followButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  unfollowButton: {
    backgroundColor: "#e74c3c",
  },
  unfollowButtonText: {
    color: "#fff",
  },
  statsContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    flex: 1,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: "#e8f4f8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#8e44ad",
  },
  editButtonActive: {
    backgroundColor: "#8e44ad",
  },
  editButtonText: {
    color: "#8e44ad",
    fontSize: 12,
    fontWeight: "600",
  },
  editButtonTextActive: {
    color: "#fff",
  },
  autoEditNotification: {
    backgroundColor: "#e8f5e8",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: "#27ae60",
  },
  autoEditText: {
    fontSize: 13,
    color: "#27ae60",
    fontWeight: "500",
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: (screenWidth - 60) / 2,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  hiddenStatCard: {
    backgroundColor: "#f0f0f0",
    opacity: 0.7,
  },
  statContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  statIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  statTitle: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 2,
  },
  statArrow: {
    fontSize: 20,
    color: "#8e44ad",
    fontWeight: "bold",
    marginLeft: 8,
  },
  privacyToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  privacyToggleLabel: {
    fontSize: 11,
    color: "#7f8c8d",
    fontWeight: "500",
  },
  privacySwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  joinDateContainer: {
    backgroundColor: "#e8f4f8",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  joinDateContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  joinDateText: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "500",
    flex: 1,
  },
  joinDatePrivacy: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#8e44ad",
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    flex: 1,
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  overallStatsContainer: {
    backgroundColor: "#fff",
    padding: 15,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  overallStatsText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "center",
  },
  gradeStatRow: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  gradeStatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  gradeLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  gradePercentage: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#8e44ad",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#ecf0f1",
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  gradeStatDetails: {
    fontSize: 12,
    color: "#7f8c8d",
    textAlign: "center",
  },
});
