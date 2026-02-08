// src/screens/SprayWall/AddWallScreen.tsx
// Screen for admins to add a new climbing wall

import React, { useState, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WallForm } from "@/components/spray/WallForm";
import { useAdmin } from "@/context/AdminContext";
import { useLanguage } from "@/features/language";
import { useTheme, lightTheme } from "@/features/theme/ThemeContext";
import { addWall } from "@/features/walls/wallsService";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Alert } from "react-native";

type Theme = typeof lightTheme;

export const AddWallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  const [loading, setLoading] = useState(false);
  
  // Create styles based on theme
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);

  const handleSubmit = async (data: {
    name: string;
    width: number;
    height: number;
    isPublic: boolean;
    imageUri: string;
  }) => {
    if (!isAdmin) {
      Alert.alert(t.common.error, t.spray.noPermissionToAddWall);
      return;
    }

    setLoading(true);
    try {
      await addWall(data);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.spray.failedToAddWall);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <WallForm onSubmit={handleSubmit} loading={loading} />
    </View>
  );
};

// Dynamic styles based on theme
const createStyles = (theme: Theme, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number }) => {
  const isLandscape = layout?.isLandscape ?? false;
  const isTablet = layout?.isTablet ?? false;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets?.left ?? 0, insets?.right ?? 0, 16) : 0;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: horizontalPadding,
  },
});
};

export default AddWallScreen;
