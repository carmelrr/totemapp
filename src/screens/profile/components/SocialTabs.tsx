import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { createStyles } from "../styles";

interface SocialTabsProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

export const SocialTabs: React.FC<SocialTabsProps> = ({ activeTab, onTabPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const tabs = [
    { id: "followers", label: "עוקבים" },
    { id: "following", label: "נעקבים" },
    { id: "search", label: "חיפוש" },
  ];

  return (
    <View style={styles.socialTabs}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.socialTab,
            activeTab === tab.id && styles.activeSocialTab,
          ]}
          onPress={() => onTabPress(tab.id)}
        >
          <Text
            style={[
              styles.socialTabText,
              activeTab === tab.id && styles.activeSocialTabText,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
