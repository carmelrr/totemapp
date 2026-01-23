// src/screens/SprayWall/RouteDetailsScreen.tsx
// Screen for entering route name and grade after marking holds

import React, { useState } from "react";
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
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { GradePicker } from "@/components/spray/GradePicker";
import { useAddRoute } from "@/features/spraywall/hooks";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/features/language";
import { Hold } from "@/features/spraywall/types";
import { getNewRandomRouteName } from "@/utils/randomRouteNames";

export const RouteDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { addRoute, loading: addingRoute } = useAddRoute();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Get data from previous screen
  const { wallId, holds } = route.params as { wallId: string; holds: Hold[] };

  const [routeName, setRouteName] = useState("");
  const [routeGrade, setRouteGrade] = useState("V0");

  // Handler for random name button
  const handleRandomName = () => {
    const newName = getNewRandomRouteName(routeName);
    setRouteName(newName);
  };

  const handleSave = async () => {
    if (!routeName.trim()) {
      Alert.alert(t.common.error, t.spray.mustEnterName);
      return;
    }

    try {
      await addRoute({
        wallId,
        name: routeName.trim(),
        grade: routeGrade,
        holds,
        createdBy: user?.uid || null,
        creatorName: user?.displayName || user?.email || undefined,
      });

      Alert.alert(t.common.success, t.spray.routeAddedSuccess, [
        {
          text: t.common.ok,
          onPress: () => {
            // Reset navigation stack to SprayHome to prevent back button issues
            navigation.reset({
              index: 0,
              routes: [{ name: "SprayHome" }],
            });
          },
        },
      ]);
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  scrollView: {
    flex: 1,
  },
  summarySection: {
    backgroundColor: "#2a2a2a",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  summaryTitle: {
    color: "#fff",
    fontSize: 16,
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
    color: "#ccc",
    fontSize: 12,
  },
  totalText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2a2a2a",
    marginTop: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  randomButton: {
    backgroundColor: "#8E4EC6",
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
    backgroundColor: "#3a3a3a",
    borderRadius: 8,
    padding: 14,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#444",
    textAlign: "right",
  },
  saveButton: {
    backgroundColor: "#8E4EC6",
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
    fontSize: 18,
    fontWeight: "bold",
  },
  backButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#888",
    fontSize: 14,
  },
});

export default RouteDetailsScreen;
