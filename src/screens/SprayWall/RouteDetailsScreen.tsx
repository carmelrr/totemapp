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
import { Hold } from "@/features/spraywall/types";

export const RouteDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { addRoute, loading: addingRoute } = useAddRoute();
  const { user } = useAuth();

  // Get data from previous screen
  const { wallId, holds } = route.params as { wallId: string; holds: Hold[] };

  const [routeName, setRouteName] = useState("");
  const [routeGrade, setRouteGrade] = useState("V0");
  const [routeDescription, setRouteDescription] = useState("");

  const handleSave = async () => {
    if (!routeName.trim()) {
      Alert.alert("שגיאה", "יש להזין שם למסלול");
      return;
    }

    try {
      await addRoute({
        wallId,
        name: routeName.trim(),
        grade: routeGrade,
        description: routeDescription.trim() || undefined,
        holds,
        createdBy: user?.uid || null,
        creatorName: user?.displayName || user?.email || undefined,
      });

      Alert.alert("הצלחה", "המסלול נוסף בהצלחה!", [
        {
          text: "אישור",
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
      Alert.alert("שגיאה", error.message || "הוספת המסלול נכשלה");
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
          <Text style={styles.summaryTitle}>סיכום אחיזות</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.holdDot, { backgroundColor: "#FF4444" }]} />
              <Text style={styles.summaryText}>
                התחלה/טופ: {holdCounts.start || 0}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.holdDot, { backgroundColor: "#4488FF" }]} />
              <Text style={styles.summaryText}>
                ביניים: {holdCounts.middle || 0}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.holdDot, { backgroundColor: "#FFCC00" }]} />
              <Text style={styles.summaryText}>
                רגליים: {holdCounts.feet || 0}
              </Text>
            </View>
          </View>
          <Text style={styles.totalText}>סה"כ: {holds.length} אחיזות</Text>
        </View>

        {/* Route Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>שם המסלול</Text>
          <TextInput
            style={styles.input}
            value={routeName}
            onChangeText={setRouteName}
            placeholder="הזן שם למסלול"
            placeholderTextColor="#666"
            autoFocus
          />
        </View>

        {/* Route Description Input (Optional) */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>הערות / בטא (לא חובה)</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={routeDescription}
            onChangeText={setRouteDescription}
            placeholder="טיפים, בטא, או הערות על המסלול..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
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
            <Text style={styles.saveButtonText}>שמור מסלול</Text>
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
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "right",
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
  descriptionInput: {
    minHeight: 80,
    paddingTop: 12,
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
