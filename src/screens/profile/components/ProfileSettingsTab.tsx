import React from "react";
import { View, Text, Switch, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import type { PrivacySettings } from "../types";

interface ProfileSettingsTabProps {
  privacySettings: PrivacySettings;
  onPrivacyChange: (key: keyof PrivacySettings, value: boolean) => void;
  isOwner: boolean;
  userDisplayName?: string;
  userStats?: {
    totalRoutesSent?: number;
    highestGrade?: string;
    totalFeedbacks?: number;
    completionPercentage?: number;
    averageStarRating?: number;
    joinDate?: Date;
  };
}

// Sample/preview data for when real stats aren't available
const getSampleValue = (key: keyof PrivacySettings): string => {
  const samples: Record<keyof PrivacySettings, string> = {
    showTotalRoutes: "42",
    showHighestGrade: "V6",
    showFeedbackCount: "15",
    showAverageRating: "4.2",
    showGradeStats: "פירוט מלא",
    showJoinDate: "01/01/2024",
    showHistory: "10 פעילויות",
  };
  return samples[key];
};

export const ProfileSettingsTab: React.FC<ProfileSettingsTabProps> = ({
  privacySettings,
  onPrivacyChange,
  isOwner,
  userDisplayName,
  userStats,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  if (!isOwner) {
    // Non-owners shouldn't see this tab
    return null;
  }

  // Get actual value or sample value for preview
  const getValue = (key: keyof PrivacySettings): string => {
    if (!userStats) return getSampleValue(key);
    
    switch (key) {
      case "showTotalRoutes":
        return userStats.totalRoutesSent?.toString() ?? getSampleValue(key);
      case "showHighestGrade":
        return userStats.highestGrade ?? getSampleValue(key);
      case "showFeedbackCount":
        return userStats.totalFeedbacks?.toString() ?? getSampleValue(key);
      case "showAverageRating":
        return userStats.averageStarRating ? userStats.averageStarRating.toFixed(1) : getSampleValue(key);
      case "showJoinDate":
        return userStats.joinDate?.toLocaleDateString("he-IL") ?? getSampleValue(key);
      default:
        return getSampleValue(key);
    }
  };

  // Privacy settings configuration with icons
  const privacyItems: Array<{
    key: keyof PrivacySettings;
    icon: string;
    labelKey: string;
    descKey: string;
  }> = [
    { key: "showAverageRating", icon: "⭐", labelKey: "showAverageRating", descKey: "showAverageRatingDesc" },
    { key: "showTotalRoutes", icon: "🎯", labelKey: "showTotalRoutes", descKey: "showTotalRoutesDesc" },
    { key: "showFeedbackCount", icon: "💬", labelKey: "showFeedbackCount", descKey: "showFeedbackCountDesc" },
    { key: "showHighestGrade", icon: "🏆", labelKey: "showHighestGrade", descKey: "showHighestGradeDesc" },
    { key: "showGradeStats", icon: "📊", labelKey: "showGradeStats", descKey: "showGradeStatsDesc" },
    { key: "showJoinDate", icon: "📅", labelKey: "showJoinDate", descKey: "showJoinDateDesc" },
    { key: "showHistory", icon: "📝", labelKey: "showHistory", descKey: "showHistoryDesc" },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Privacy Settings Section */}
      <View style={styles.section}>
        <View style={styles.headerContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.privacy.title}
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
            {t.privacy.description}
          </Text>
        </View>

        {/* Table Header */}
        <View style={[styles.tableHeader, { backgroundColor: theme.primary + "15", borderColor: theme.border }]}>
          <View style={styles.tableHeaderLeft}>
            <Text style={[styles.tableHeaderText, { color: theme.text }]}>{t.privacy.infoHeader}</Text>
          </View>
          <View style={styles.tableHeaderCenter}>
            <Text style={[styles.tableHeaderText, { color: theme.text }]}>{t.privacy.valueHeader}</Text>
          </View>
          <View style={styles.tableHeaderRight}>
            <Text style={[styles.tableHeaderText, { color: theme.text }]}>{t.privacy.showHeader}</Text>
          </View>
        </View>

        {/* Privacy Table */}
        <View style={[styles.privacyTable, { borderColor: theme.border }]}>
          {privacyItems.map((item, index) => {
            const isVisible = privacySettings[item.key];
            const value = getValue(item.key);
            const isLastItem = index === privacyItems.length - 1;
            
            return (
              <View 
                key={item.key} 
                style={[
                  styles.tableRow,
                  { 
                    backgroundColor: isVisible ? theme.surface : theme.background,
                    borderBottomColor: theme.border,
                    borderBottomWidth: isLastItem ? 0 : 1,
                  }
                ]}
              >
                {/* Info Column */}
                <View style={styles.tableColumnLeft}>
                  <View style={styles.infoRow}>
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                    <View style={styles.itemTextContainer}>
                      <Text style={[styles.itemLabel, { color: theme.text }]}>
                        {t.privacy[item.labelKey]}
                      </Text>
                      <Text style={[styles.itemDesc, { color: theme.textSecondary }]}>
                        {t.privacy[item.descKey]}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Value Preview Column */}
                <View style={styles.tableColumnCenter}>
                  <View style={[
                    styles.valuePreview,
                    { 
                      backgroundColor: isVisible ? theme.primary + "20" : theme.border + "50",
                    }
                  ]}>
                    <Text style={[
                      styles.valueText,
                      { 
                        color: isVisible ? theme.text : theme.textSecondary,
                        textDecorationLine: isVisible ? "none" : "line-through",
                      }
                    ]}>
                      {value}
                    </Text>
                    {!isVisible && (
                      <Text style={styles.hiddenIcon}>🔒</Text>
                    )}
                  </View>
                </View>

                {/* Toggle Column */}
                <View style={styles.tableColumnRight}>
                  <Switch
                    value={isVisible}
                    onValueChange={(val) => onPrivacyChange(item.key, val)}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor={isVisible ? "#fff" : theme.card}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <View style={[styles.summaryContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryIcon}>👁️</Text>
            <Text style={[styles.summaryText, { color: theme.text }]}>
              {t.privacy.showingItems(Object.values(privacySettings).filter(Boolean).length, Object.keys(privacySettings).length)}
            </Text>
          </View>
          <Text style={[styles.summaryHint, { color: theme.textSecondary }]}>
            {t.privacy.settingsHint}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  headerContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  tableHeaderLeft: {
    flex: 2,
  },
  tableHeaderCenter: {
    flex: 1,
    alignItems: "center",
  },
  tableHeaderRight: {
    width: 60,
    alignItems: "center",
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  privacyTable: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  tableColumnLeft: {
    flex: 2,
    paddingEnd: 8,
  },
  tableColumnCenter: {
    flex: 1,
    alignItems: "center",
  },
  tableColumnRight: {
    width: 60,
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  itemIcon: {
    fontSize: 20,
    marginEnd: 10,
    marginTop: 2,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  valuePreview: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    justifyContent: "center",
  },
  valueText: {
    fontSize: 13,
    fontWeight: "600",
  },
  hiddenIcon: {
    fontSize: 12,
    marginStart: 4,
  },
  summaryContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryIcon: {
    fontSize: 18,
    marginEnd: 8,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: "600",
  },
  summaryHint: {
    fontSize: 12,
    lineHeight: 18,
  },
});
