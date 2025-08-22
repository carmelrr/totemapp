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
  const styles = createStyles(theme);

  const renderGradeStat = (grade: string, data: any) => {
    const percentage = data.percentage || 0;
    const completed = data.completed || 0;
    const total = data.total || 0;

    // Convert percentage to color (green = high, red = low)
    const getProgressColor = (pct: number) => {
      if (pct >= 80) return "#27ae60";
      if (pct >= 60) return "#f39c12";
      return "#e74c3c";
    };

    return (
      <View key={grade} style={styles.gradeStatRow}>
        <View style={styles.gradeStatHeader}>
          <Text style={styles.gradeLabel}>גרייד {grade}</Text>
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
          {completed} מתוך {total} קווים הושלמו
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
        trackColor={{ false: "#767577", true: "#667eea" }}
        thumbColor={privacySettings[key] ? "#fff" : "#f4f3f4"}
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
            <Text style={styles.modalTitle}>סטטיסטיקות מפורטות</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Overall Stats */}
            {stats && (
              <View style={styles.overallStatsContainer}>
                <Text style={styles.overallStatsText}>
                  סה״כ {stats.totalRoutesSent} קווים נשלחו
                </Text>
                <Text style={styles.overallStatsText}>
                  גרייד הכי גבוה: {stats.highestGrade}
                </Text>
                <Text style={styles.overallStatsText}>
                  דירוג ממוצע: {stats.averageStarRating.toFixed(1)} ⭐
                </Text>
              </View>
            )}

            {/* Grade Stats */}
            <View style={styles.sectionTitle}>
              <Text style={styles.modalTitle}>סטטיסטיקות לפי גרייד</Text>
            </View>
            {Object.entries(gradeStats).map(([grade, data]) =>
              renderGradeStat(grade, data)
            )}

            {/* Join Date */}
            {stats?.joinDate && (
              <View style={styles.joinDateContainer}>
                <View style={styles.joinDateContent}>
                  <Text style={styles.joinDateText}>
                    תאריך הצטרפות: {stats.joinDate.toLocaleDateString("he-IL")}
                  </Text>
                  <View style={styles.joinDatePrivacy}>
                    {renderPrivacyToggle("showJoinDate", "הצג תאריך")}
                  </View>
                </View>
              </View>
            )}

            {/* Privacy Settings */}
            <View style={styles.preferencesSection}>
              <Text style={styles.sectionTitle}>הגדרות פרטיות</Text>
              <View style={styles.privacyEditNotification}>
                <Text style={styles.privacyEditText}>
                  בחר אילו נתונים יוצגו לאחרים בפרופיל שלך
                </Text>
              </View>
              
              {renderPrivacyToggle(
                "showHighestGrade",
                "הצג גרייד הכי גבוה",
                "הגרייד הכי קשה שהשלמת"
              )}
              {renderPrivacyToggle(
                "showFeedbackCount",
                "הצג כמות פידבקים",
                "כמה פידבקים קיבלת על הקווים שלך"
              )}
              {renderPrivacyToggle(
                "showAverageRating",
                "הצג דירוג ממוצע",
                "הדירוג הממוצע שקיבלת מאחרים"
              )}
              {renderPrivacyToggle(
                "showGradeStats",
                "הצג סטטיסטיקות גרייד",
                "פירוט הצלחות לפי רמת קושי"
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
