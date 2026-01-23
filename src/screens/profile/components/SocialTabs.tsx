import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { createStyles } from "../styles";

interface SocialTabsProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

export const SocialTabs: React.FC<SocialTabsProps> = ({ activeTab, onTabPress }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);

  const tabs = [
    { id: "followers", label: t.profile.followers },
    { id: "following", label: t.profile.following },
    { id: "search", label: t.common.search },
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
