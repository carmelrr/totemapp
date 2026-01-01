import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { auth } from "@/features/data/firebase";
import { fetchUserStats, calculateGradeStats } from "../services/statsService";
import { statsRefreshEvent } from "@/utils/events/statsRefreshEvent";
import type { UserStats, GradeStatsMap } from "../types";

export function useProfileStats() {
  const user = auth.currentUser;
  const [userStats, setUserStats] = useState<UserStats>({
    totalRoutesSent: 0,
    highestGrade: "N/A",
    totalFeedbacks: 0,
    averageStarRating: 0,
    completionPercentage: 0,
    joinDate: null,
  });
  const [gradeStats, setGradeStats] = useState<GradeStatsMap>({});
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user) return;
    
    try {
      const [stats, gradeData] = await Promise.all([
        fetchUserStats(user.uid),
        calculateGradeStats(user.uid),
      ]);
      
      setUserStats(stats);
      setGradeStats(gradeData.gradeStats);
      setAllRoutes(gradeData.routes);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadStats();
    } catch (error) {
      Alert.alert("שגיאה", "נכשל ברענון הנתונים");
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Subscribe to stats refresh events (e.g., when feedback is submitted elsewhere)
  useEffect(() => {
    const unsubscribe = statsRefreshEvent.subscribe(() => {
      loadStats();
    });
    return unsubscribe;
  }, [loadStats]);

  return {
    userStats,
    gradeStats,
    allRoutes,
    refreshing,
    onRefresh,
    reloadStats: loadStats,
  };
}
