import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { createStyles } from "../styles";
import type { UserStats } from "../types";

interface StatsDashboardProps {
  stats: UserStats | null;
  onStatsPress: () => void;
  loading: boolean;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  stats,
  onStatsPress,
  loading,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={styles.statsContainer}>
        <Text style={styles.loadingText}>טוען סטטיסטיקות...</Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.statsContainer}>
        <Text style={styles.emptyText}>אין סטטיסטיקות זמינות</Text>
      </View>
    );
  }

  const statsData = [
    {
      icon: "🎯",
      value: stats.totalRoutesSent,
      title: "קווים סה״כ",
    },
    {
      icon: "🏆",
      value: stats.highestGrade,
      title: "גרייד הכי גבוה",
    },
    {
      icon: "💬",
      value: stats.totalFeedbacks,
      title: "פידבקים",
    },
    {
      icon: "⭐",
      value: stats.averageStarRating.toFixed(1),
      title: "דירוג ממוצע",
    },
  ];

  return (
    <TouchableOpacity style={styles.statsContainer} onPress={onStatsPress}>
      <View style={styles.statsHeader}>
        <Text style={styles.statsTitle}>הסטטיסטיקות שלי</Text>
        <Text style={styles.statArrow}>◀</Text>
      </View>
      
      <View style={styles.statsGrid}>
        {statsData.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <View style={styles.statContent}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statTitle}>{stat.title}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};
