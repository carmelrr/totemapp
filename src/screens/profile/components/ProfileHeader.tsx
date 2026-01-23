import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { createStyles } from "../styles";

interface ProfileHeaderProps {
  onMenuPress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ onMenuPress }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>{t.profile.myProfile}</Text>
        <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
          <Text style={styles.menuIcon}>≡</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
