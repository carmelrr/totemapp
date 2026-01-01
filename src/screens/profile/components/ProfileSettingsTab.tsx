import React from "react";
import { View, Text, Switch, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import type { PrivacySettings } from "../types";

interface ProfileSettingsTabProps {
  privacySettings: PrivacySettings;
  onPrivacyChange: (key: keyof PrivacySettings, value: boolean) => void;
  isOwner: boolean;
  userDisplayName?: string;
}

export const ProfileSettingsTab: React.FC<ProfileSettingsTabProps> = ({
  privacySettings,
  onPrivacyChange,
  isOwner,
  userDisplayName,
}) => {
  const { theme } = useTheme();

  if (!isOwner) {
    // Non-owners shouldn't see this tab
    return null;
  }

  const renderPrivacyToggle = (
    key: keyof PrivacySettings,
    label: string,
    description?: string
  ) => (
    <View key={key} style={[styles.privacyItem, { backgroundColor: theme.surface }]}>
      <View style={styles.privacyTextContainer}>
        <Text style={[styles.privacyLabel, { color: theme.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.privacyDescription, { color: theme.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={privacySettings[key]}
        onValueChange={(value) => onPrivacyChange(key, value)}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={privacySettings[key] ? "#fff" : theme.card}
      />
    </View>
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Privacy Settings Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          🔒 הגדרות פרטיות
        </Text>
        <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
          בחר אילו נתונים יוצגו לאחרים בפרופיל שלך
        </Text>

        <View style={styles.privacyList}>
          {renderPrivacyToggle(
            "showTotalRoutes",
            "הצג מספר מסלולים שסגרתי",
            "מספר כל המסלולים שסגרת אי פעם"
          )}
          {renderPrivacyToggle(
            "showHighestGrade",
            "הצג דירוג הכי גבוה",
            "הגרייד הכי קשה שהשלמת"
          )}
          {renderPrivacyToggle(
            "showFeedbackCount",
            "הצג כמות פידבקים",
            "כמה פידבקים נתת על מסלולים"
          )}
          {renderPrivacyToggle(
            "showAverageRating",
            "הצג אחוז סגירה",
            "אחוז המסלולים שסגרת מתוך הקיר"
          )}
          {renderPrivacyToggle(
            "showGradeStats",
            "הצג סטטיסטיקות מפורטות",
            "סטטיסטיקות לפי דירוג גרייד"
          )}
          {renderPrivacyToggle(
            "showJoinDate",
            "הצג תאריך הצטרפות",
            "מאז מתי אתה חבר באפליקציה"
          )}
          {renderPrivacyToggle(
            "showHistory",
            "הצג היסטוריית פעילות",
            "פידבקים וסגירות אחרונות שלך"
          )}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  privacyList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  privacyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  privacyTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  privacyLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  privacyDescription: {
    fontSize: 12,
    marginTop: 4,
  },
});
