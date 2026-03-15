// src/screens/SprayWall/RouteDetailsScreen.tsx
// Screen for entering route name and grade after marking holds

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradePicker } from "@/components/spray/GradePicker";
import { useAddRoute, useRoutesForWall } from "@/features/spraywall/hooks";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/features/language";
import { Hold, HoldNumberEntry, MaskPath } from "@/features/spraywall/types";
import { getNewRandomRouteName } from "@/utils/randomRouteNames";
import { useTheme, lightTheme } from "@/features/theme/ThemeContext";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

type Theme = typeof lightTheme;

export const RouteDetailsScreen: React.FC = () => {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet, width } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { addRoute, loading: addingRoute } = useAddRoute();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Get data from previous screen
  const { wallId, holds, holdNumbering, maskPaths } = route.params as { 
    wallId: string; 
    holds: Hold[];
    holdNumbering?: HoldNumberEntry[];
    maskPaths?: MaskPath[];
  };

  // Existing routes for dedup in random name generator
  const { routes: existingRoutes } = useRoutesForWall(wallId || '');
  const existingNames = useMemo(() => existingRoutes.map(r => r.name), [existingRoutes]);

  const [routeName, setRouteName] = useState("");
  const [routeGrade, setRouteGrade] = useState("V0");

  // Handler for random name button
  const handleRandomName = () => {
    const newName = getNewRandomRouteName(routeName, existingNames);
    setRouteName(newName);
  };

  const handleSave = async () => {
    if (!routeName.trim()) {
      Alert.alert(t.common.error, t.spray.mustEnterName);
      return;
    }

    // Check if user is logged in
    if (!user?.uid) {
      Alert.alert(t.common.error, t.spray.loginToAddRoute);
      return;
    }

    try {
      console.log('🔵 [RouteDetailsScreen] Adding route with:', {
        wallId,
        name: routeName.trim(),
        grade: routeGrade,
        holdsCount: holds.length,
        createdBy: user.uid,
        creatorName: user.displayName || user.email,
      });
      
      await addRoute({
        wallId,
        name: routeName.trim(),
        grade: routeGrade,
        holds,
        createdBy: user.uid,
        creatorName: user.displayName || user.email || undefined,
        holdNumbering,
        maskPaths,
      });

      // Reset navigation stack to SprayHome to prevent back button issues
      navigation.reset({
        index: 0,
        routes: [{ name: "SprayHome" }],
      });
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.spray.failedToAddRoute);
    }
  };

  // Count holds by type
  const holdCounts = holds.reduce(
    (acc, hold) => {
      acc[hold.type] = (acc[hold.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.scrollView}>
        {/* Summary of marked holds */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>{t.spray.holdsSummary}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.holdDot, { backgroundColor: "#FF4444" }]} />
              <Text style={styles.summaryText}>
                {t.spray.startTop}: {holdCounts.start || 0}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.holdDot, { backgroundColor: "#4488FF" }]} />
              <Text style={styles.summaryText}>
                {t.spray.middle}: {holdCounts.middle || 0}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.holdDot, { backgroundColor: "#FFCC00" }]} />
              <Text style={styles.summaryText}>
                {t.spray.feet}: {holdCounts.feet || 0}
              </Text>
            </View>
          </View>
          <Text style={styles.totalText}>{t.spray.totalHolds} {holds.length} {t.spray.holds}</Text>
        </View>

        {/* Route Name Input */}
        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t.spray.routeName}</Text>
            <TouchableOpacity 
              style={styles.randomButton} 
              onPress={handleRandomName}
            >
              <Text style={styles.randomButtonText}>{t.spray.randomName}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={routeName}
            onChangeText={setRouteName}
            placeholder={t.spray.enterRouteName}
            placeholderTextColor="#666"
            autoFocus
          />
        </View>

        {/* Grade Picker */}
        <GradePicker
          selectedGrade={routeGrade}
          onSelectGrade={setRouteGrade}
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, addingRoute && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={addingRoute}
        >
          {addingRoute ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{t.spray.saveRoute}</Text>
          )}
        </TouchableOpacity>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={addingRoute}
        >
          <Text style={styles.backButtonText}>חזור לעריכת אחיזות</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: Theme, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number }) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLandscape = layout?.isLandscape ?? screenWidth > screenHeight;
  const isTablet = layout?.isTablet ?? false;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets?.left ?? 0, insets?.right ?? 0, 16) : 16;
  const contentMaxWidth = isLandscape ? Math.min((layout?.width ?? screenWidth) * 0.6, 500) : undefined;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  summarySection: {
    backgroundColor: theme.surface,
    padding: isLandscape ? 12 : 16,
    margin: horizontalPadding,
    borderRadius: 12,
    maxWidth: contentMaxWidth,
    alignSelf: isLandscape ? 'center' : undefined,
    width: isLandscape ? '100%' : undefined,
  },
  summaryTitle: {
    color: theme.text,
    fontSize: isLandscape ? 14 : 16,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  holdDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  summaryText: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  totalText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  inputSection: {
    paddingHorizontal: horizontalPadding,
    paddingVertical: isLandscape ? 8 : 12,
    backgroundColor: theme.surface,
    marginTop: 8,
    maxWidth: contentMaxWidth,
    alignSelf: isLandscape ? 'center' : undefined,
    width: isLandscape ? '100%' : undefined,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  randomButton: {
    backgroundColor: theme.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  randomButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    backgroundColor: theme.inputBackground,
    borderRadius: 8,
    padding: 14,
    color: theme.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.secondary,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: isLandscape ? 16 : 18,
    fontWeight: "bold",
  },
  backButton: {
    marginHorizontal: horizontalPadding,
    marginBottom: isLandscape ? 12 : 16,
    padding: 12,
    alignItems: "center",
    maxWidth: contentMaxWidth,
    alignSelf: isLandscape ? 'center' : undefined,
    width: isLandscape ? '100%' : undefined,
  },
  backButtonText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
});
};

export default RouteDetailsScreen;
