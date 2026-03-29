import React from "react";
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  Switch 
} from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { createStyles } from "../styles";
import type { UserStats, GradeStatsMap, PrivacySettings } from "../types";

interface GradeStatsModalProps {
  visible: boolean;
  onClose: () => void;
  stats: UserStats | null;
  gradeStats: GradeStatsMap;
  privacySettings: PrivacySettings;
  onPrivacyChange: (key: keyof PrivacySettings, value: boolean) => void;
}

export const GradeStatsModal: React.FC<GradeStatsModalProps> = ({
  visible,
  onClose,
  stats,
  gradeStats,
  privacySettings,
  onPrivacyChange,
}) => {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const styles = createStyles(theme);

  // Sort grades from easy to hard (V0, V1, V2, ... V17)
  const gradeOrder: Record<string, number> = {
    V0: 0, V1: 1, V2: 2, V3: 3, V4: 4, V5: 5,
    V6: 6, V7: 7, V8: 8, V9: 9, V10: 10,
    V11: 11, V12: 12, V13: 13, V14: 14, V15: 15, V16: 16, V17: 17,
  };
  
  const sortedGradeEntries = Object.entries(gradeStats).sort(([a], [b]) => {
    return (gradeOrder[a] ?? 999) - (gradeOrder[b] ?? 999);
  });

  const renderGradeStat = (grade: string, data: any) => {
    const percentage = data.percentage || 0;
    const completed = data.completed || 0;
    const total = data.total || 0;

    // Convert percentage to color (green = high, orange = medium, red = low)
    const getProgressColor = (pct: number) => {
      if (pct >= 80) return theme.success;
      if (pct >= 60) return theme.warning;
      return theme.error;
    };

    return (
      <View key={grade} style={styles.gradeStatRow}>
        <View style={styles.gradeStatHeader}>
          <Text style={styles.gradeLabel}>{t.gradeStats.grade(grade)}</Text>
          <Text style={styles.gradePercentage}>{percentage.toFixed(1)}%</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${percentage}%`,
                backgroundColor: getProgressColor(percentage),
              },
            ]}
          />
        </View>
        <Text style={styles.gradeStatDetails}>
          {t.gradeStats.routesCompleted(completed, total)}
        </Text>
      </View>
    );
  };

  const renderPrivacyToggle = (
    key: keyof PrivacySettings,
    label: string,
    description?: string
  ) => (
    <View key={key} style={styles.privacyToggleContainer}>
      <View style={{ flex: 1 }}>
        <Text style={styles.privacyToggleLabel}>{label}</Text>
        {description && (
          <Text style={[styles.privacyToggleLabel, { fontSize: 10, opacity: 0.7 }]}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={privacySettings[key]}
        onValueChange={(value) => onPrivacyChange(key, value)}
        style={styles.privacySwitch}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={privacySettings[key] ? "#fff" : theme.card}
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.gradeStats.detailedStats}</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Overall Stats */}
            {stats && (
              <View style={styles.overallStatsContainer}>
                <Text style={styles.overallStatsText}>
                  {t.gradeStats.totalRoutesSent(stats.totalRoutesSent)}
                </Text>
                <Text style={styles.overallStatsText}>
                  {t.gradeStats.highestGrade(stats.highestGrade)}
                </Text>
                <Text style={styles.overallStatsText}>
                  {t.gradeStats.avgRating(stats.averageStarRating.toFixed(1))}
                </Text>
              </View>
            )}

            {/* Grade Stats */}
            <View style={styles.sectionTitle}>
              <Text style={styles.modalTitle}>{t.gradeStats.statsByGrade}</Text>
            </View>
            {sortedGradeEntries.map(([grade, data]) =>
              renderGradeStat(grade, data)
            )}

            {/* Join Date */}
            {stats?.joinDate && (
              <View style={styles.joinDateContainer}>
                <View style={styles.joinDateContent}>
                  <Text style={styles.joinDateText}>
                    {t.gradeStats.joinDate(stats.joinDate.toLocaleDateString(language === "he" ? "he-IL" : "en-US"))}
                  </Text>
                  <View style={styles.joinDatePrivacy}>
                    {renderPrivacyToggle("showJoinDate", t.gradeStats.showJoinDate)}
                  </View>
                </View>
              </View>
            )}

            {/* Privacy Settings */}
            <View style={styles.preferencesSection}>
              <Text style={styles.sectionTitle}>{t.gradeStats.privacySettings}</Text>
              <View style={styles.privacyEditNotification}>
                <Text style={styles.privacyEditText}>
                  {t.gradeStats.privacyDescription}
                </Text>
              </View>
              
              {renderPrivacyToggle(
                "showHighestGrade",
                t.gradeStats.showHighestGrade,
                t.gradeStats.showHighestGradeDesc
              )}
              {renderPrivacyToggle(
                "showAverageRating",
                t.gradeStats.showAvgRating,
                t.gradeStats.showAvgRatingDesc
              )}
              {renderPrivacyToggle(
                "showGradeStats",
                t.gradeStats.showGradeStats,
                t.gradeStats.showGradeStatsDesc
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
