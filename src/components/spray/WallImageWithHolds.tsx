// src/components/spray/WallImageWithHolds.tsx
// Component that displays wall image with hold markers (static and editable)
// Supports zoom/pan when no active hold, and ring resize/move when active hold exists

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  Text,
  LayoutChangeEvent,
} from "react-native";
import { 
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { HoldRingsOverlay } from "./HoldRingsOverlay";
import { Hold } from "@/features/spraywall/types";

interface WallImageWithHoldsProps {
  imageUrl: string;
  holds: Hold[];                          // Locked/static holds
  activeHold?: Hold | null;               // Currently editing hold
  routeColor?: string;                    // Color for new holds
  onCreateHold?: (normalizedX: number, normalizedY: number) => void;
  onUpdateActiveHold?: (updated: Hold) => void;
  editable?: boolean;
}

export const WallImageWithHolds: React.FC<WallImageWithHoldsProps> = ({
  imageUrl,
  holds,
  activeHold = null,
  routeColor = "#FF4444",
  onCreateHold,
  onUpdateActiveHold,
  editable = true,
}) => {
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Ref to always have the latest activeHold value
  const activeHoldRef = React.useRef<Hold | null>(null);
  activeHoldRef.current = activeHold;

  // Image zoom/pan state
  const imageScale = useSharedValue(1);
  const imageTranslateX = useSharedValue(0);
  const imageTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Shared value to track if we have an active hold (for worklet access)
  const hasActiveHold = useSharedValue(false);

  // Active hold manipulation state
  const startRadius = useSharedValue(0.05);
  const currentRadius = useSharedValue(0.05);
  const startHoldX = useSharedValue(0);
  const startHoldY = useSharedValue(0);
  const currentHoldX = useSharedValue(0);
  const currentHoldY = useSharedValue(0);
  
  // Track the active hold ID to detect when a NEW hold is selected
  const [lastActiveHoldId, setLastActiveHoldId] = useState<string | null>(null);

  // Sync activeHold to shared values ONLY when a new hold is selected
  useEffect(() => {
    const currentId = activeHold?.id ?? null;
    hasActiveHold.value = !!activeHold;
    
    // Only sync values when switching to a DIFFERENT hold
    if (activeHold && currentId !== lastActiveHoldId) {
      currentRadius.value = activeHold.radius;
      currentHoldX.value = activeHold.x;
      currentHoldY.value = activeHold.y;
      setLastActiveHoldId(currentId);
    } else if (!activeHold) {
      setLastActiveHoldId(null);
    }
  }, [activeHold]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setImageWidth(width);
    setImageHeight(height);
  }, []);

  const handleImageLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // Clamp image position to keep it within bounds
  const clampImagePosition = useCallback((translateX: number, translateY: number, scale: number) => {
    if (!imageWidth || !imageHeight) return { x: translateX, y: translateY };
    
    // Calculate how much the image extends beyond the container
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;
    
    // Calculate max translation (half of overflow on each side)
    const maxTranslateX = Math.max(0, (scaledWidth - imageWidth) / 2);
    const maxTranslateY = Math.max(0, (scaledHeight - imageHeight) / 2);
    
    return {
      x: Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX)),
      y: Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY)),
    };
  }, [imageWidth, imageHeight]);

  // Update hold radius from pinch (called on gesture end)
  const updateHoldRadius = useCallback((newRadius: number) => {
    const hold = activeHoldRef.current;
    if (!hold || !onUpdateActiveHold) return;
    // Use current shared values to avoid stale closure issues
    onUpdateActiveHold({
      ...hold,
      x: currentHoldX.value,
      y: currentHoldY.value,
      radius: newRadius,
    });
  }, [onUpdateActiveHold]);

  // Update hold position from pan (called on gesture end)
  const updateHoldPosition = useCallback((newX: number, newY: number) => {
    const hold = activeHoldRef.current;
    if (!hold || !onUpdateActiveHold) return;
    // Use current shared values to avoid stale closure issues
    onUpdateActiveHold({
      ...hold,
      x: newX,
      y: newY,
      radius: currentRadius.value,
    });
  }, [onUpdateActiveHold]);

  // Update hold position and radius together (called on gesture end)
  const updateHoldFinal = useCallback((newX: number, newY: number, newRadius: number) => {
    const hold = activeHoldRef.current;
    if (!hold || !onUpdateActiveHold) return;
    onUpdateActiveHold({
      ...hold,
      x: newX,
      y: newY,
      radius: newRadius,
    });
  }, [onUpdateActiveHold]);

  // Update image position with clamping
  const updateImagePosition = useCallback((translateX: number, translateY: number) => {
    const clamped = clampImagePosition(translateX, translateY, imageScale.value);
    imageTranslateX.value = clamped.x;
    imageTranslateY.value = clamped.y;
  }, [clampImagePosition]);

  // Create new hold on tap
  const createHoldAtPosition = useCallback((x: number, y: number) => {
    if (!onCreateHold || !imageWidth || !imageHeight) return;
    
    const scale = imageScale.value;
    const translateX = imageTranslateX.value;
    const translateY = imageTranslateY.value;
    
    // The image is scaled from its center
    // First, find the center of the container
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    
    // The tap position relative to the center
    const tapFromCenterX = x - centerX;
    const tapFromCenterY = y - centerY;
    
    // Account for translation and scale:
    // The image center is at (centerX + translateX, centerY + translateY)
    // So the tap relative to the scaled image center is:
    const relativeToImageCenterX = tapFromCenterX - translateX;
    const relativeToImageCenterY = tapFromCenterY - translateY;
    
    // Convert to unscaled coordinates (divide by scale)
    const unscaledX = relativeToImageCenterX / scale;
    const unscaledY = relativeToImageCenterY / scale;
    
    // Convert back to position from top-left corner
    const imageX = centerX + unscaledX;
    const imageY = centerY + unscaledY;
    
    // Normalize to 0-1
    const normalizedX = imageX / imageWidth;
    const normalizedY = imageY / imageHeight;
    
    if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
      onCreateHold(normalizedX, normalizedY);
    }
  }, [onCreateHold, imageWidth, imageHeight]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    imageScale.value = withSpring(1);
    imageTranslateX.value = withSpring(0);
    imageTranslateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  // === GESTURES ===

  // Tap gesture - create new hold (only when no active hold)
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      if (!hasActiveHold.value) {
        runOnJS(createHoldAtPosition)(event.x, event.y);
      }
    });

  // Double tap to reset zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (!hasActiveHold.value) {
        runOnJS(resetZoom)();
      }
    });

  // Pinch gesture - zoom image OR resize active hold
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      if (hasActiveHold.value) {
        startRadius.value = currentRadius.value;
      } else {
        savedScale.value = imageScale.value;
      }
    })
    .onUpdate((event) => {
      if (hasActiveHold.value) {
        // Resize hold - only update shared value (smooth)
        const newRadius = Math.max(0.02, Math.min(0.3, startRadius.value * event.scale));
        currentRadius.value = newRadius;
      } else {
        // Zoom image
        const newScale = Math.max(1, Math.min(4, savedScale.value * event.scale));
        imageScale.value = newScale;
      }
    })
    .onEnd(() => {
      if (hasActiveHold.value) {
        // Update React state only at the end
        runOnJS(updateHoldRadius)(currentRadius.value);
      } else {
        // Clamp position after zoom
        runOnJS(updateImagePosition)(imageTranslateX.value, imageTranslateY.value);
      }
    });

  // Pan gesture - move image OR move active hold
  const panGesture = Gesture.Pan()
    .onStart(() => {
      if (hasActiveHold.value) {
        startHoldX.value = currentHoldX.value;
        startHoldY.value = currentHoldY.value;
      } else {
        savedTranslateX.value = imageTranslateX.value;
        savedTranslateY.value = imageTranslateY.value;
      }
    })
    .onUpdate((event) => {
      if (hasActiveHold.value) {
        // Move hold - only update shared values (smooth)
        const deltaX = event.translationX / (imageWidth * imageScale.value);
        const deltaY = event.translationY / (imageHeight * imageScale.value);
        const newX = Math.max(0, Math.min(1, startHoldX.value + deltaX));
        const newY = Math.max(0, Math.min(1, startHoldY.value + deltaY));
        currentHoldX.value = newX;
        currentHoldY.value = newY;
      } else {
        // Move image with bounds checking
        const newTranslateX = savedTranslateX.value + event.translationX;
        const newTranslateY = savedTranslateY.value + event.translationY;
        
        // Calculate bounds
        const scaledWidth = imageWidth * imageScale.value;
        const scaledHeight = imageHeight * imageScale.value;
        const maxTranslateX = Math.max(0, (scaledWidth - imageWidth) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - imageHeight) / 2);
        
        imageTranslateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
        imageTranslateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY));
      }
    })
    .onEnd(() => {
      if (hasActiveHold.value) {
        // Update React state only at the end
        runOnJS(updateHoldPosition)(currentHoldX.value, currentHoldY.value);
      }
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, tapGesture),
    pinchGesture,
    panGesture
  );

  // Animated style for image zoom/pan
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: imageTranslateX.value },
        { translateY: imageTranslateY.value },
        { scale: imageScale.value },
      ] as const,
    };
  });

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>שגיאה בטעינת התמונה</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.container} onLayout={handleLayout}>
          <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              onLoad={handleImageLoad}
              onError={() => setError(true)}
            />

            {/* Single SVG overlay for all hold rings - ensures transparent overlaps */}
            {!loading && (
              <HoldRingsOverlay
                holds={holds}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                activeHold={activeHold}
                activeHoldX={currentHoldX}
                activeHoldY={currentHoldY}
                activeHoldRadius={currentRadius}
              />
            )}
          </Animated.View>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#8E4EC6" />
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {editable && !activeHold && (
        <Text style={styles.hint}>
          לחץ ליצירת טבעת • צבוט לזום • טאפ כפול לאיפוס
        </Text>
      )}
      {editable && activeHold && (
        <Text style={styles.hint}>
          גרור להזזה • צבוט לשינוי גודל
        </Text>
      )}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    overflow: "hidden",
  },
  imageWrapper: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 16,
  },
  hint: {
    textAlign: "center",
    color: "#888",
    fontSize: 12,
    paddingVertical: 8,
    backgroundColor: "#2a2a2a",
  },
});

export default WallImageWithHolds;
