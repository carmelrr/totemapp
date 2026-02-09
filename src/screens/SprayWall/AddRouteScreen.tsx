// src/screens/SprayWall/AddRouteScreen.tsx
// Screen for users to mark holds on the wall - name and grade are set in the next screen

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WallPicker } from "@/components/spray/WallPicker";
import { WallImageWithHolds } from "@/components/spray/WallImageWithHolds";
import { HoldTypePicker } from "@/components/spray/HoldTypePicker";
import { useWalls } from "@/features/walls/hooks";
import { useLanguage } from "@/features/language";
import { useTheme, lightTheme } from "@/features/theme/ThemeContext";
import { Wall, Hold, HoldType, HOLD_TYPES } from "@/features/spraywall/types";
import { updateRoute } from "@/features/spraywall/routesService";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

type Theme = typeof lightTheme;

// Generate unique ID
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

export const AddRouteScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { walls, loading: wallsLoading } = useWalls();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet } = layout;
  const isPhoneLandscape = !isTablet && isLandscape;
  
  // Create styles based on theme
  const styles = useMemo(() => createStyles(theme, layout, insets), [theme, layout, insets]);

  // Edit mode params
  const isEditMode = route.params?.editMode === true;
  const editRouteId = route.params?.routeId;
  const existingHolds = route.params?.existingHolds;
  const editRouteName = route.params?.routeName;
  const editRouteGrade = route.params?.routeGrade;

  // Pre-selected wall from navigation params
  const preSelectedWallId = route.params?.wallId;
  const preSelectedWall = walls.find((w) => w.id === preSelectedWallId);

  const [selectedWall, setSelectedWall] = useState<Wall | null>(preSelectedWall || null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Auto-select wall when there's only one wall
  useEffect(() => {
    if (!selectedWall && !wallsLoading && walls.length === 1) {
      setSelectedWall(walls[0]);
    }
  }, [walls, wallsLoading, selectedWall]);

  // Load existing holds in edit mode
  useEffect(() => {
    if (isEditMode && existingHolds && existingHolds.length > 0) {
      setLockedHolds(existingHolds);
    }
  }, [isEditMode, existingHolds]);

  // Update header title for edit mode
  useEffect(() => {
    if (isEditMode) {
      navigation.setOptions({ title: t.spray.editHolds });
    }
  }, [isEditMode, navigation, t]);
  
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

  // Select existing hold for editing
  const handleSelectExistingHold = useCallback((hold: Hold) => {
    // Remove from locked holds and make it active for editing
    setLockedHolds((prev) => prev.filter((h) => h.id !== hold.id));
    setActiveHold(hold);
  }, []);

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

  // Navigate to next screen (Route Details) or save in edit mode
  const handleContinue = async () => {
    if (!selectedWall) {
      Alert.alert(t.common.error, t.spray.selectWall);
      return;
    }
    if (lockedHolds.length === 0) {
      Alert.alert(t.common.error, t.spray.mustSelectHolds);
      return;
    }

    if (isEditMode && editRouteId) {
      // In edit mode, save the holds directly
      setIsSaving(true);
      try {
        await updateRoute(editRouteId, {
          holds: lockedHolds,
        });
        // Go back to return to SprayRouteDetail
        navigation.pop(1);
      } catch (error) {
        console.error("Error updating route holds:", error);
        Alert.alert(t.common.error, t.spray.failedToUpdateHolds);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Navigate to route details screen with the holds data
      navigation.navigate("RouteDetails", {
        wallId: selectedWall.id,
        holds: lockedHolds,
      });
    }
  };

  // Get current hold color for the editable ring
  const currentHoldColor = HOLD_TYPES[selectedHoldType].color;

  return (
    <View style={styles.container}>
      {/* Wall Picker - only show when no wall selected */}
      {!selectedWall && (
        <ScrollView style={styles.scrollView}>
          <WallPicker
            walls={walls}
            selectedWallId={selectedWall?.id || null}
            onSelectWall={handleSelectWall}
            loading={wallsLoading}
          />
          {/* Empty state when no wall selected */}
          {!wallsLoading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>👆</Text>
              <Text style={styles.emptyStateText}>{t.spray.selectWallToStart}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Wall Image with Hold Rings - Full screen when wall selected */}
      {selectedWall && (
        <View style={styles.fullScreenImageSection}>
          {/* Top bar with wall name and action buttons - only in portrait */}
          {!isPhoneLandscape && (
            <View style={styles.topBar}>
              <View style={styles.topBarLeft}>
                <Text style={styles.wallName}>{selectedWall.name}</Text>
                <Text style={styles.holdCountBadge}>
                  {lockedHolds.length} {t.spray.holdsMarked}
                </Text>
              </View>
              <View style={styles.topBarRight}>
                {lockedHolds.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearHolds}
                  >
                    <Text style={styles.clearButtonText}>{t.spray.clearAll}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Main content - image and controls */}
          <View style={styles.mainContentRow}>
            {/* Active hold actions bar - only in portrait */}
            {!isPhoneLandscape && (
              <View style={styles.activeHoldActions}>
                {activeHold ? (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelActiveHold}
                  >
                    <Text style={styles.actionButtonText}>✕</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.placeholderButton} />
                )}
                <Text style={styles.activeHoldHint}>
                  {activeHold ? t.spray.dragToMove : t.spray.tapToAddHold || 'לחץ על הקיר להוספת טבעת'}
                </Text>
                {activeHold ? (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleConfirmActiveHold}
                  >
                    <Text style={styles.actionButtonText}>✔</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.placeholderButton} />
                )}
              </View>
            )}

            {/* Large image container - takes most of the screen */}
            <View style={styles.largeImageContainer}>
              <WallImageWithHolds
                imageUrl={selectedWall.imageUrl}
                holds={lockedHolds}
                activeHold={activeHold}
                routeColor={currentHoldColor}
                onCreateHold={handleCreateHold}
                onUpdateActiveHold={handleUpdateActiveHold}
                onSelectHold={handleSelectExistingHold}
                editable={true}
              />
            </View>

            {/* Side controls - in landscape mode */}
            {isPhoneLandscape && (
              <View style={styles.sideControls}>
                {/* Wall info */}
                <View style={styles.sideControlsHeader}>
                  <Text style={styles.sideWallName}>{selectedWall.name}</Text>
                  <Text style={styles.sideHoldCount}>{lockedHolds.length}</Text>
                </View>
                
                {/* Hold Type Picker - vertical */}
                <HoldTypePicker
                  selectedType={selectedHoldType}
                  onSelectType={setSelectedHoldType}
                  compact={true}
                />
                
                {/* Action buttons */}
                <View style={styles.sideActionButtons}>
                  {activeHold && (
                    <>
                      <TouchableOpacity
                        style={styles.sideCancelButton}
                        onPress={handleCancelActiveHold}
                      >
                        <Text style={styles.sideActionButtonText}>✕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.sideConfirmButton}
                        onPress={handleConfirmActiveHold}
                      >
                        <Text style={styles.sideActionButtonText}>✔</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {lockedHolds.length > 0 && (
                    <TouchableOpacity
                      style={styles.sideClearButton}
                      onPress={handleClearHolds}
                    >
                      <Text style={styles.sideClearButtonText}>{t.spray.clearAll}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                  style={[
                    styles.sideContinueButton,
                    (lockedHolds.length === 0 || isSaving) && styles.continueButtonDisabled,
                  ]}
                  onPress={handleContinue}
                  disabled={lockedHolds.length === 0 || isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.sideContinueButtonText}>
                      {isEditMode ? t.spray.saveChanges : '→'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Bottom controls - only in portrait mode */}
          {!isPhoneLandscape && (
            <View style={styles.bottomControls}>
              {/* Hold Type Picker */}
              <HoldTypePicker
                selectedType={selectedHoldType}
                onSelectType={setSelectedHoldType}
              />

              {/* Continue Button */}
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  (lockedHolds.length === 0 || isSaving) && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={lockedHolds.length === 0 || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.continueButtonText}>
                    {isEditMode ? t.spray.saveChanges : t.spray.continueToDetails}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Dynamic styles based on theme
const createStyles = (theme: Theme, layout?: ReturnType<typeof useResponsiveLayout>, insets?: { left: number; right: number; top: number; bottom: number }) => {
  const isLandscape = layout?.isLandscape ?? false;
  const isTablet = layout?.isTablet ?? false;
  const isPhoneLandscape = !isTablet && isLandscape;
  const horizontalPadding = isLandscape ? Math.max(insets?.left ?? 0, insets?.right ?? 0, 16) : 16;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  // Full screen image section (when wall is selected)
  fullScreenImageSection: {
    flex: 1,
    display: 'flex',
    flexDirection: isLandscape ? 'row' : 'column',
  },
  // Top bar with wall name and actions
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: horizontalPadding,
    paddingVertical: isPhoneLandscape ? 6 : 10,
    backgroundColor: theme.surface,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  wallName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  holdCountBadge: {
    color: theme.textSecondary,
    fontSize: 13,
    backgroundColor: theme.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeWallText: {
    color: theme.secondary,
    fontSize: 14,
  },
  activeHoldActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  activeHoldHint: {
    color: theme.textSecondary,
    fontSize: 12,
    flex: 1,
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: theme.success,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: theme.error,
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
  placeholderButton: {
    width: 44,
    height: 44,
  },
  // Main content row - horizontal in landscape
  mainContentRow: {
    flex: 1,
    flexDirection: isPhoneLandscape ? 'row' : 'column',
  },
  // Large image container - takes most of screen space
  largeImageContainer: {
    flex: 1,
    marginHorizontal: isPhoneLandscape ? 4 : 8,
    marginVertical: isPhoneLandscape ? 4 : 8,
    borderRadius: 12,
    overflow: "hidden",
    minHeight: isPhoneLandscape ? undefined : 400,
  },
  // Side controls for landscape mode
  sideControls: {
    width: 90,
    backgroundColor: theme.surface,
    padding: 8,
    paddingEnd: Math.max(insets?.right ?? 0, 8),
    justifyContent: 'space-between',
    alignItems: 'center',
    borderStartWidth: 1,
    borderStartColor: theme.border,
  },
  sideControlsHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sideWallName: {
    color: theme.text,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sideHoldCount: {
    color: theme.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  sideActionButtons: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  sideCancelButton: {
    backgroundColor: theme.error,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideConfirmButton: {
    backgroundColor: theme.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sideClearButton: {
    backgroundColor: theme.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sideClearButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  sideContinueButton: {
    backgroundColor: theme.secondary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideContinueButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Bottom controls area - fixed at bottom
  bottomControls: {
    backgroundColor: theme.background,
    paddingBottom: isPhoneLandscape ? 8 : 16,
    paddingHorizontal: horizontalPadding,
  },
  clearButton: {
    backgroundColor: theme.error,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  continueButton: {
    backgroundColor: theme.secondary,
    marginHorizontal: horizontalPadding,
    marginTop: isPhoneLandscape ? 8 : 12,
    padding: isPhoneLandscape ? 10 : 14,
    borderRadius: 12,
    alignItems: "center",
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: isPhoneLandscape ? 16 : 18,
    fontWeight: "bold",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: isPhoneLandscape ? 60 : 100,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
});
};

export default AddRouteScreen;
