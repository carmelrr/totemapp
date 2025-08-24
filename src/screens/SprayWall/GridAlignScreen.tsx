// screens/SprayWall/GridAlignScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { THEME_COLORS } from "@/constants/colors";

interface GridAlignScreenProps {
  navigation: any;
  route: {
    params: {
      imageUri: string;
      homography: any;
      canonW: number;
      canonH: number;
      wallId?: string;
      isReplace?: boolean;
    };
  };
}

export const GridAlignScreen: React.FC<GridAlignScreenProps> = ({
  navigation,
  route: routeParams,
}) => {
  const { imageUri, homography, canonW, canonH, wallId, isReplace } =
    routeParams.params;

  const [gridSpacing, setGridSpacing] = useState(100); // בפיקסלים
  const [gridRotation, setGridRotation] = useState(0); // ברדיאנים
  const [gridOriginX, setGridOriginX] = useState(0);
  const [gridOriginY, setGridOriginY] = useState(0);
  const [gridPattern, setGridPattern] = useState<"square" | "staggered">(
    "square",
  );
  const [gridVisible, setGridVisible] = useState(true);

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleContinue = () => {
    const gridSpec = {
      spacing: gridSpacing,
      rotation: gridRotation,
      origin: { x: gridOriginX, y: gridOriginY },
      pattern: gridPattern,
    };

    navigation.navigate("SymmetryToolsScreen", {
      imageUri,
      homography,
      canonW,
      canonH,
      gridSpec,
      wallId,
      isReplace,
    });
  };

  const handleSkip = () => {
    // שמור ללא רשת
    saveWallAndFinish(null);
  };

  const saveWallAndFinish = async (gridSpec: any) => {
    try {
      // TODO: שמירת הקיר עם הרשת ב-Firebase
      Alert.alert("הצלחה", "הקיר נשמר בהצלחה", [
        {
          text: "אישור",
          onPress: () => navigation.navigate("SprayWallMapView", { wallId }),
        },
      ]);
    } catch (error) {
      Alert.alert("שגיאה", "לא ניתן לשמור את הקיר");
    }
  };

  const resetGrid = () => {
    setGridSpacing(100);
    setGridRotation(0);
    setGridOriginX(0);
    setGridOriginY(0);
    setGridPattern("square");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.headerButton}>ביטול</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>יישור רשת T-Nuts</Text>
        <TouchableOpacity onPress={resetGrid}>
          <Text style={styles.headerButton}>איפוס</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          התאם את הרשת לתבנית ה-T-nuts בקיר
        </Text>
      </View>

      {/* Image with Grid Overlay */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />

        {/* Grid Overlay */}
        {gridVisible && (
          <View style={styles.gridOverlay}>
            {/* TODO: רנדור רשת דינמית */}
            <View style={styles.gridPlaceholder}>
              <Text style={styles.gridText}>רשת T-Nuts כאן</Text>
              <Text style={styles.gridInfo}>
                מרווח: {Math.round(gridSpacing)}px
              </Text>
              <Text style={styles.gridInfo}>
                זווית: {Math.round((gridRotation * 180) / Math.PI)}°
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Grid Visibility Toggle */}
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.toggleButton, gridVisible && styles.activeToggle]}
            onPress={() => setGridVisible(!gridVisible)}
          >
            <Text
              style={[
                styles.toggleText,
                gridVisible && styles.activeToggleText,
              ]}
            >
              {gridVisible ? "👁️ הסתר רשת" : "👁️‍🗨️ הצג רשת"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Grid Pattern */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>תבנית רשת:</Text>
          <View style={styles.patternButtons}>
            <TouchableOpacity
              style={[
                styles.patternButton,
                gridPattern === "square" && styles.activePatternButton,
              ]}
              onPress={() => setGridPattern("square")}
            >
              <Text
                style={[
                  styles.patternButtonText,
                  gridPattern === "square" && styles.activePatternButtonText,
                ]}
              >
                רגילה
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.patternButton,
                gridPattern === "staggered" && styles.activePatternButton,
              ]}
              onPress={() => setGridPattern("staggered")}
            >
              <Text
                style={[
                  styles.patternButtonText,
                  gridPattern === "staggered" && styles.activePatternButtonText,
                ]}
              >
                מזוזזת
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacing Slider */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>
            מרווח: {Math.round(gridSpacing)}px
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={50}
            maximumValue={200}
            value={gridSpacing}
            onValueChange={setGridSpacing}
            minimumTrackTintColor={THEME_COLORS.primary}
            maximumTrackTintColor={THEME_COLORS.border}
          />
        </View>

        {/* Rotation Slider */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>
            זווית: {Math.round((gridRotation * 180) / Math.PI)}°
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={-Math.PI / 4}
            maximumValue={Math.PI / 4}
            value={gridRotation}
            onValueChange={setGridRotation}
            minimumTrackTintColor={THEME_COLORS.primary}
            maximumTrackTintColor={THEME_COLORS.border}
          />
        </View>

        {/* Origin X Slider */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>
            מיקום X: {Math.round(gridOriginX)}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={-50}
            maximumValue={50}
            value={gridOriginX}
            onValueChange={setGridOriginX}
            minimumTrackTintColor={THEME_COLORS.primary}
            maximumTrackTintColor={THEME_COLORS.border}
          />
        </View>

        {/* Origin Y Slider */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>
            מיקום Y: {Math.round(gridOriginY)}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={-50}
            maximumValue={50}
            value={gridOriginY}
            onValueChange={setGridOriginY}
            minimumTrackTintColor={THEME_COLORS.primary}
            maximumTrackTintColor={THEME_COLORS.border}
          />
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>דלג</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>המשך</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
  },
  headerButton: {
    fontSize: 16,
    color: THEME_COLORS.primary,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME_COLORS.text,
  },
  instructions: {
    backgroundColor: THEME_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.border,
  },
  instructionsText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    textAlign: "center",
  },
  imageContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 123, 255, 0.1)",
  },
  gridText: {
    fontSize: 16,
    fontWeight: "bold",
    color: THEME_COLORS.primary,
    marginBottom: 8,
  },
  gridInfo: {
    fontSize: 12,
    color: THEME_COLORS.textSecondary,
  },
  controls: {
    backgroundColor: THEME_COLORS.surface,
    padding: 16,
    gap: 16,
  },
  controlRow: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME_COLORS.text,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: "center",
  },
  activeToggle: {
    backgroundColor: THEME_COLORS.primary,
    borderColor: THEME_COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME_COLORS.text,
  },
  activeToggleText: {
    color: "#FFFFFF",
  },
  patternButtons: {
    flexDirection: "row",
    gap: 8,
  },
  patternButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    alignItems: "center",
  },
  activePatternButton: {
    backgroundColor: THEME_COLORS.primary,
    borderColor: THEME_COLORS.primary,
  },
  patternButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME_COLORS.text,
  },
  activePatternButtonText: {
    color: "#FFFFFF",
  },
  slider: {
    height: 40,
  },
  bottomActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  skipButton: {
    flex: 1,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME_COLORS.text,
  },
  continueButton: {
    flex: 1,
    backgroundColor: THEME_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
