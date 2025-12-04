// src/screens/SprayWall/AddRouteScreen.tsx
// Screen for users to mark holds on the wall - name and grade are set in the next screen

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { WallPicker } from "@/components/spray/WallPicker";
import { WallImageWithHolds } from "@/components/spray/WallImageWithHolds";
import { HoldTypePicker } from "@/components/spray/HoldTypePicker";
import { useWalls } from "@/features/walls/hooks";
import { Wall, Hold, HoldType, HOLD_TYPES } from "@/features/spraywall/types";

// Generate unique ID
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

export const AddRouteScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { walls, loading: wallsLoading } = useWalls();

  // Pre-selected wall from navigation params
  const preSelectedWallId = route.params?.wallId;
  const preSelectedWall = walls.find((w) => w.id === preSelectedWallId);

  const [selectedWall, setSelectedWall] = useState<Wall | null>(preSelectedWall || null);
  
  // Current hold type selection
  const [selectedHoldType, setSelectedHoldType] = useState<HoldType>('middle');

  // Hold state - separated into locked and active
  const [lockedHolds, setLockedHolds] = useState<Hold[]>([]);
  const [activeHold, setActiveHold] = useState<Hold | null>(null);
  
  // Ref to always have the latest activeHold value
  const activeHoldRef = useRef<Hold | null>(null);
  activeHoldRef.current = activeHold;

  const handleSelectWall = (wall: Wall) => {
    setSelectedWall(wall);
    setLockedHolds([]);
    setActiveHold(null);
  };

  // Create new hold when tapping on image
  const handleCreateHold = useCallback((normalizedX: number, normalizedY: number) => {
    const holdTypeInfo = HOLD_TYPES[selectedHoldType];
    const newHold: Hold = {
      id: generateId(),
      x: normalizedX,
      y: normalizedY,
      radius: 0.05, // Default radius: 5% of image width
      type: selectedHoldType,
      color: holdTypeInfo.color,
    };
    setActiveHold(newHold);
  }, [selectedHoldType]);

  // Update active hold during drag/resize
  const handleUpdateActiveHold = useCallback((updated: Hold) => {
    setActiveHold(updated);
  }, []);

  // Confirm (lock) the active hold - uses ref to get latest value
  const handleConfirmActiveHold = useCallback(() => {
    const currentHold = activeHoldRef.current;
    if (!currentHold) return;
    setLockedHolds((prev) => [...prev, currentHold]);
    setActiveHold(null);
  }, []);

  // Clear all holds
  const handleClearHolds = useCallback(() => {
    setLockedHolds([]);
    setActiveHold(null);
  }, []);

  // Cancel active hold
  const handleCancelActiveHold = useCallback(() => {
    setActiveHold(null);
  }, []);

  // Navigate to next screen (Route Details)
  const handleContinue = () => {
    if (!selectedWall) {
      Alert.alert("שגיאה", "יש לבחור קיר");
      return;
    }
    if (lockedHolds.length === 0) {
      Alert.alert("שגיאה", "יש לסמן לפחות אחיזה אחת על הקיר");
      return;
    }

    // Navigate to route details screen with the holds data
    navigation.navigate("RouteDetails", {
      wallId: selectedWall.id,
      holds: lockedHolds,
    });
  };

  // Get current hold color for the editable ring
  const currentHoldColor = HOLD_TYPES[selectedHoldType].color;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} stickyHeaderIndices={selectedWall ? [] : [0]}>
        {/* Wall Picker - only show when no wall selected */}
        {!selectedWall && (
          <WallPicker
            walls={walls}
            selectedWallId={selectedWall?.id || null}
            onSelectWall={handleSelectWall}
            loading={wallsLoading}
          />
        )}

        {/* Wall Image with Hold Rings */}
        {selectedWall && (
          <View style={styles.imageSection}>
            {/* Selected wall header with change option */}
            <View style={styles.wallHeader}>
              <TouchableOpacity onPress={() => setSelectedWall(null)}>
                <Text style={styles.changeWallText}>החלף קיר</Text>
              </TouchableOpacity>
              <Text style={styles.wallName}>{selectedWall.name}</Text>
            </View>

            {/* Confirm/Cancel buttons for active hold */}
            {activeHold && (
              <View style={styles.activeHoldActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelActiveHold}
                >
                  <Text style={styles.actionButtonText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.activeHoldHint}>גרור להזיז • צבוט לשנות גודל</Text>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirmActiveHold}
                >
                  <Text style={styles.actionButtonText}>✔</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.imageContainer}>
              <WallImageWithHolds
                imageUrl={selectedWall.imageUrl}
                holds={lockedHolds}
                activeHold={activeHold}
                routeColor={currentHoldColor}
                onCreateHold={handleCreateHold}
                onUpdateActiveHold={handleUpdateActiveHold}
                editable={true}
              />
            </View>

            {/* Hold Type Picker */}
            <HoldTypePicker
              selectedType={selectedHoldType}
              onSelectType={setSelectedHoldType}
            />

            {/* Hold count and actions */}
            <View style={styles.holdActions}>
              <Text style={styles.holdCount}>
                {lockedHolds.length} אחיזות מסומנות
              </Text>
              {lockedHolds.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearHolds}
                >
                  <Text style={styles.clearButtonText}>נקה הכל</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                lockedHolds.length === 0 && styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={lockedHolds.length === 0}
            >
              <Text style={styles.continueButtonText}>המשך לפרטי המסלול</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state when no wall selected */}
        {!selectedWall && !wallsLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>👆</Text>
            <Text style={styles.emptyStateText}>בחר קיר כדי להתחיל</Text>
          </View>
        )}
      </ScrollView>
    </View>
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
  imageSection: {
    marginTop: 8,
  },
  wallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2a2a2a",
  },
  wallName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  changeWallText: {
    color: "#8E4EC6",
    fontSize: 14,
  },
  activeHoldActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#333",
  },
  activeHoldHint: {
    color: "#aaa",
    fontSize: 12,
    flex: 1,
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#FF6B6B",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  imageContainer: {
    height: 400,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  holdActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  holdCount: {
    color: "#888",
    fontSize: 14,
  },
  clearButton: {
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  continueButton: {
    backgroundColor: "#8E4EC6",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    color: "#888",
    fontSize: 16,
  },
});

export default AddRouteScreen;
