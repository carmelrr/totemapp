// screens/HomeScreen.tsx
// Main Feed / Home Screen - Feed of followed users' closures and feedbacks
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { auth } from "@/features/data/firebase";
import { getFollowingFeed } from "@/features/social/socialService";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AnnouncementsList } from "@/features/announcements/components/AnnouncementsList";

interface FeedItem {
  id: string;
  type: "closure" | "feedback";
  userId: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  routeId: string;
  routeName: string;
  routeNameHe?: string;
  routeNameEn?: string;
  routeGrade: string;
  routeColor: string;
  routeX?: number;
  routeY?: number;
  feedback: {
    starRating: number;
    suggestedGrade: string;
    comment: string;
    closedRoute: boolean;
  };
  createdAt: Date | string;
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      backgroundColor: theme.headerGradient,
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 15,
      borderBottomLeftRadius: 25,
      borderBottomRightRadius: 25,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#fff",
      textAlign: "center",
    },
    listContent: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 100,
    },
    feedItem: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    feedHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    userAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.border,
      marginLeft: 12,
      borderWidth: 2,
      borderColor: theme.primary,
    },
    userAvatarFallback: {
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    userAvatarInitial: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "700",
    },
    userInfo: {
      flex: 1,
      alignItems: "flex-end",
    },
    userName: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "right",
    },
    timestamp: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    feedTypeIndicator: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    closureIndicator: {
      backgroundColor: "#2ecc71",
    },
    feedbackIndicator: {
      backgroundColor: theme.primary,
    },
    feedTypeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
    },
    routeInfo: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    routeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    routeName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
      textAlign: "right",
    },
    routeNameContainer: {
      flex: 1,
      alignItems: "flex-end",
    },
    gradeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginLeft: 8,
    },
    gradeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "bold",
    },
    feedbackDetails: {
      marginTop: 12,
    },
    starRating: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 8,
    },
    star: {
      fontSize: 18,
      marginLeft: 2,
    },
    comment: {
      fontSize: 14,
      color: theme.text,
      textAlign: "right",
      lineHeight: 22,
    },
    suggestedGrade: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: "right",
      marginTop: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
      paddingTop: 80,
    },
    emptyIcon: {
      fontSize: 60,
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 10,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    loadingMore: {
      paddingVertical: 20,
      alignItems: "center",
    },
  });

export default function HomeScreen() {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const styles = createStyles(theme);
  const navigation = useNavigation();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);

  // Get route name based on language
  const getRouteDisplayName = useCallback((item: FeedItem): string => {
    // If we have language-specific names, use them
    if (language === 'he' && item.routeNameHe) {
      return item.routeNameHe;
    }
    if (language === 'en' && item.routeNameEn) {
      return item.routeNameEn;
    }
    // Fall back to default name
    return item.routeName;
  }, [language]);

  const loadFeed = useCallback(async (refresh = false) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      if (refresh) {
        setRefreshing(true);
      }

      const result = await getFollowingFeed(userId, 20, refresh ? null : lastTimestamp);
      
      if (refresh) {
        setFeedItems(result.items);
      } else {
        setFeedItems((prev) => [...prev, ...result.items]);
      }
      
      setHasMore(result.hasMore);
      setLastTimestamp(result.lastTimestamp);
    } catch (error) {
      console.error("Error loading feed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [lastTimestamp]);

  useEffect(() => {
    loadFeed(true);
  }, []);

  const onRefresh = useCallback(() => {
    setLastTimestamp(null);
    loadFeed(true);
  }, [loadFeed]);

  const onEndReached = useCallback(() => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadFeed(false);
    }
  }, [loadingMore, hasMore, loadFeed]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t.time.justNow;
    if (diffMins < 60) return t.time.minutesAgo(diffMins);
    if (diffHours < 24) return t.time.hoursAgo(diffHours);
    if (diffDays < 7) return t.time.daysAgo(diffDays);
    
    return d.toLocaleDateString(language === "he" ? "he-IL" : "en-US");
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Text key={i} style={styles.star}>
        {i < rating ? "⭐" : "☆"}
      </Text>
    ));
  };

  const navigateToUserProfile = (userId: string) => {
    navigation.navigate("ProfileTab", {
      screen: "UserProfile",
      params: { userId },
    });
  };

  const navigateToRouteDetails = (item: FeedItem) => {
    // Build route object for RouteDetailsScreen
    const routeForDetails = {
      id: item.routeId,
      name: item.routeName,
      color: item.routeColor,
      grade: item.routeGrade,
      difficulty: item.routeGrade,
      coordinates: {
        x: item.routeX || 0.5,
        y: item.routeY || 0.5,
      },
      createdAt: new Date(),
    };
    
    navigation.navigate("RoutesMapTab", {
      screen: "RouteDetails",
      params: { route: routeForDetails },
    });
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => (
    <View style={styles.feedItem}>
      {/* Feed Header - User info */}
      <TouchableOpacity 
        style={styles.feedHeader}
        onPress={() => navigateToUserProfile(item.userId)}
      >
        <View style={[
          styles.feedTypeIndicator, 
          item.type === "closure" ? styles.closureIndicator : styles.feedbackIndicator
        ]}>
          <Text style={styles.feedTypeText}>
            {item.type === "closure" ? t.home.closed : t.home.feedbackItem}
          </Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.userDisplayName}</Text>
          <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
        </View>
        
        <UserAvatar
          photoURL={item.userPhotoURL}
          displayName={item.userDisplayName}
          size={44}
          style={styles.userAvatar}
        />
      </TouchableOpacity>

      {/* Route Info - Clickable to navigate to route details */}
      <TouchableOpacity 
        style={styles.routeInfo}
        onPress={() => navigateToRouteDetails(item)}
      >
        <View style={styles.routeHeader}>
          <View style={[styles.gradeChip, { backgroundColor: item.routeColor }]}>
            <Text style={styles.gradeText}>{item.routeGrade}</Text>
          </View>
          <View style={styles.routeNameContainer}>
            <Text style={styles.routeName}>{getRouteDisplayName(item)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Feedback Details */}
      <View style={styles.feedbackDetails}>
        {item.feedback.starRating > 0 && (
          <View style={styles.starRating}>
            {renderStars(item.feedback.starRating)}
          </View>
        )}
        
        {item.feedback.comment && (
          <Text style={styles.comment}>{item.feedback.comment}</Text>
        )}
        
        {item.feedback.suggestedGrade && (
          <Text style={styles.suggestedGrade}>
            {t.routes.suggestedGrade}: {item.feedback.suggestedGrade}
          </Text>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>👥</Text>
      <Text style={styles.emptyTitle}>{t.home.noRecentActivity}</Text>
      <Text style={styles.emptyText}>
        {t.routes.noFeedbacksYet}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.home.title}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.home.title}</Text>
      </View>
      
      <FlatList
        data={feedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={<AnnouncementsList />}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
      />
    </SafeAreaView>
  );
}
