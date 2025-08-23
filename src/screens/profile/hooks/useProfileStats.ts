import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { auth } from "@/features/data/firebase";
import { fetchUserStats, calculateGradeStats } from "../services/statsService";
import type { UserStats, GradeStatsMap } from "../types";

export function useProfileStats() {
  const user = auth.currentUser;
  const [userStats, setUserStats] = useState<UserStats>({
    totalRoutesSent: 0,
    highestGrade: "N/A",
    totalFeedbacks: 0,
    averageStarRating: 0,
    joinDate: null,
  });
  const [gradeStats, setGradeStats] = useState<GradeStatsMap>({});
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
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
  };

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

  useEffect(() => {
    loadStats();
  }, [user]);

  return {
    userStats,
    gradeStats,
    allRoutes,
    refreshing,
    onRefresh,
    reloadStats: loadStats,
  };
}
