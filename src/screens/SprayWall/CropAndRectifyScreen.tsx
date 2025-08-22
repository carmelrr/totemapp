// screens/SprayWall/CropAndRectifyScreen.tsx
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PanGestureHandler,
  PinchGestureHandler,
} from "react-native-gesture-handler";
import { createRectifyHomography } from "@/features/image/homography";
import { THEME_COLORS } from "@/constants/colors";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface CropAndRectifyScreenProps {
  navigation: any;
  route: {
    params: {
      imageUri: string;
      imageWidth: number;
      imageHeight: number;
      wallId?: string;
      isReplace?: boolean;
    };
  };
}

interface Corner {
  x: number;
  y: number;
  id: string;
}

export const CropAndRectifyScreen: React.FC<CropAndRectifyScreenProps> = ({
  navigation,
  route: routeParams,
}) => {
  const { imageUri, imageWidth, imageHeight, wallId, isReplace } =
    routeParams.params;

  // 4 פינות להומוגרפיה
  const [corners, setCorners] = useState<Corner[]>([
    { id: "top-left", x: 50, y: 50 },
    { id: "top-right", x: screenWidth - 50, y: 50 },
    { id: "bottom-right", x: screenWidth - 50, y: 400 },
    { id: "bottom-left", x: 50, y: 400 },
  ]);

  const [selectedCorner, setSelectedCorner] = useState<string | null>(null);

  const handleCornerDrag = (cornerId: string, x: number, y: number) => {
    setCorners((prevCorners) =>
      prevCorners.map((corner) =>
        corner.id === cornerId ? { ...corner, x, y } : corner,
      ),
    );
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleReset = () => {
    setCorners([
      { id: "top-left", x: 50, y: 50 },
      { id: "top-right", x: screenWidth - 50, y: 50 },
      { id: "bottom-right", x: screenWidth - 50, y: 400 },
      { id: "bottom-left", x: 50, y: 400 },
    ]);
  };

  const handleContinue = () => {
    try {
      // חשב הומוגרפיה
      const canonicalWidth = 2048;
      const canonicalHeight = Math.round(
        (canonicalWidth * imageHeight) / imageWidth,
      );

      const srcCorners = corners.map((c) => ({ x: c.x, y: c.y }));
      const homography = createRectifyHomography(
        srcCorners,
        canonicalWidth,
        canonicalHeight,
      );

      Alert.alert("הומוגרפיה מחושבת", "המשך להגדרת רשת וסימטריה?", [
        {
          text: "דלג",
          onPress: () =>
            saveWallAndFinish(homography, canonicalWidth, canonicalHeight),
        },
        {
          text: "המשך",
          onPress: () =>
            navigateToGridAlign(homography, canonicalWidth, canonicalHeight),
        },
      ]);
    } catch (error) {
      Alert.alert(
        "שגיאה",
        "לא ניתן לחשב הומוגרפיה. בדוק שהפינות יוצרות מלבן תקין.",
      );
    }
  };

  const navigateToGridAlign = (
    homography: any,
    canonW: number,
    canonH: number,
  ) => {
    navigation.navigate("GridAlignScreen", {
      imageUri,
      homography,
      canonW,
      canonH,
      wallId,
      isReplace,
    });
  };

  const saveWallAndFinish = async (
    homography: any,
    canonW: number,
    canonH: number,
  ) => {
    try {
      // TODO: שמירת הקיר ב-Firebase
      Alert.alert("הצלחה", "הקיר נשמר בהצלחה", [
        {
          text: "אישור",
          onPress: () => navigation.navigate("SprayWallScreen", { wallId }),
        },
      ]);
    } catch (error) {
      Alert.alert("שגיאה", "לא ניתן לשמור את הקיר");
    }
  };

  const renderCorner = (corner: Corner) => (
    <TouchableOpacity
      key={corner.id}
      style={[
        styles.corner,
        {
          left: corner.x - 15,
          top: corner.y - 15,
        },
        selectedCorner === corner.id && styles.selectedCorner,
      ]}
      onPress={() => setSelectedCorner(corner.id)}
      // TODO: הוסף gesture handlers לגרירה
    >
      <View style={styles.cornerInner} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.headerButton}>ביטול</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>חיתוך ויישור</Text>
        <TouchableOpacity onPress={handleReset}>
          <Text style={styles.headerButton}>איפוס</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          גרור את הפינות כך שיתאימו לפינות הקיר בתמונה
        </Text>
      </View>

      {/* Image with Corners */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />

        {/* Overlay with corners */}
        <View style={styles.overlay}>
          {corners.map(renderCorner)}

          {/* Connection lines */}
          <View style={styles.linesContainer}>
            {/* TODO: הוסף קווי חיבור בין הפינות */}
          </View>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>המשך</Text>
        </TouchableOpacity>
      </View>

      {/* Corner Info */}
      {selectedCorner && (
        <View style={styles.cornerInfo}>
          <Text style={styles.cornerInfoText}>
            פינה נבחרת:{" "}
            {selectedCorner === "top-left"
              ? "שמאל עליון"
              : selectedCorner === "top-right"
                ? "ימין עליון"
                : selectedCorner === "bottom-right"
                  ? "ימין תחתון"
                  : "שמאל תחתון"}
          </Text>
        </View>
      )}
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
    lineHeight: 20,
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME_COLORS.primary,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: THEME_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedCorner: {
    backgroundColor: THEME_COLORS.warning,
    borderColor: THEME_COLORS.primary,
  },
  cornerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  linesContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomActions: {
    padding: 20,
  },
  continueButton: {
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
  cornerInfo: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  cornerInfoText: {
    fontSize: 14,
    color: THEME_COLORS.text,
    fontWeight: "600",
  },
});
