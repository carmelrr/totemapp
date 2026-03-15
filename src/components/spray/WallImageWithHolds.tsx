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
import { Hold, HoldNumberEntry, MaskPath } from "@/features/spraywall/types";

interface WallImageWithHoldsProps {
  imageUrl: string;
  holds: Hold[];                          // Locked/static holds
  activeHold?: Hold | null;               // Currently editing hold
  routeColor?: string;                    // Color for new holds
  onCreateHold?: (normalizedX: number, normalizedY: number) => void;
  onUpdateActiveHold?: (updated: Hold) => void;
  onSelectHold?: (hold: Hold) => void;    // Callback when existing hold is tapped
  editable?: boolean;
  // Numbering mode
  numberingMode?: boolean;
  onNumberHold?: (hold: Hold) => void;    // Callback when hold is tapped in numbering mode
  holdNumbering?: HoldNumberEntry[];      // Numbers to display on holds
  // Drawing mode
  drawingMode?: boolean;
  onAddMaskPath?: (path: MaskPath) => void; // Callback when a mask stroke is completed
  maskPaths?: MaskPath[];                   // Mask paths to display
}

export const WallImageWithHolds: React.FC<WallImageWithHoldsProps> = ({
  imageUrl,
  holds,
  activeHold = null,
  routeColor = "#FF4444",
  onCreateHold,
  onUpdateActiveHold,
  onSelectHold,
  editable = true,
  numberingMode = false,
  onNumberHold,
  holdNumbering,
  drawingMode = false,
  onAddMaskPath,
  maskPaths,
}) => {
  // Container dimensions (from onLayout)
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  // Natural/actual image dimensions (from Image.getSize)
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Calculate the actual displayed image dimensions within the container (for resizeMode="contain")
  // This accounts for letterboxing
  const getDisplayedImageDimensions = useCallback(() => {
    if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) {
      return { width: containerWidth, height: containerHeight, offsetX: 0, offsetY: 0 };
    }

    const containerAspect = containerWidth / containerHeight;
    const imageAspect = naturalWidth / naturalHeight;

    let displayedWidth: number;
    let displayedHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > containerAspect) {
      // Image is wider than container - width fills container, height is smaller
      displayedWidth = containerWidth;
      displayedHeight = containerWidth / imageAspect;
      offsetY = (containerHeight - displayedHeight) / 2;
    } else {
      // Image is taller than container - height fills container, width is smaller
      displayedHeight = containerHeight;
      displayedWidth = containerHeight * imageAspect;
      offsetX = (containerWidth - displayedWidth) / 2;
    }

    return { width: displayedWidth, height: displayedHeight, offsetX, offsetY };
  }, [containerWidth, containerHeight, naturalWidth, naturalHeight]);

  // Get the displayed image dimensions
  const displayedImage = getDisplayedImageDimensions();
  const imageWidth = displayedImage.width;
  const imageHeight = displayedImage.height;
  const imageOffsetX = displayedImage.offsetX;
  const imageOffsetY = displayedImage.offsetY;

  // Ref to always have the latest activeHold value
  const activeHoldRef = React.useRef<Hold | null>(null);
  activeHoldRef.current = activeHold;

  // Ref to always have the latest holds array
  const holdsRef = React.useRef<Hold[]>([]);
  holdsRef.current = holds;

  // Refs for drawing and numbering modes
  const drawingModeRef = React.useRef(false);
  drawingModeRef.current = drawingMode;
  const numberingModeRef = React.useRef(false);
  numberingModeRef.current = numberingMode;

  // Drawing state - current stroke being drawn
  const currentDrawingPoints = React.useRef<{ x: number; y: number }[]>([]);

  // Shared values to track modes in worklets
  const isDrawingMode = useSharedValue(false);
  const isNumberingMode = useSharedValue(false);

  // Sync mode shared values
  useEffect(() => {
    isDrawingMode.value = drawingMode;
  }, [drawingMode]);

  useEffect(() => {
    isNumberingMode.value = numberingMode;
  }, [numberingMode]);

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

  // Fetch natural image dimensions when URL changes
  useEffect(() => {
    if (imageUrl) {
      Image.getSize(
        imageUrl,
        (width, height) => {
          setNaturalWidth(width);
          setNaturalHeight(height);
        },
        (error) => {
          console.error('Failed to get image size:', error);
          // Fallback: use container dimensions if we can't get natural size
          setNaturalWidth(containerWidth);
          setNaturalHeight(containerHeight);
        }
      );
    }
  }, [imageUrl]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerWidth(width);
    setContainerHeight(height);
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

  // Check if tap position is inside an existing hold
  const findHoldAtPosition = useCallback((normalizedX: number, normalizedY: number): Hold | null => {
    const currentHolds = holdsRef.current;
    // Check in reverse order (last added holds are on top)
    for (let i = currentHolds.length - 1; i >= 0; i--) {
      const hold = currentHolds[i];
      const dx = normalizedX - hold.x;
      const dy = normalizedY - hold.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Check if tap is within the hold's radius
      if (distance <= hold.radius) {
        return hold;
      }
    }
    return null;
  }, []);

  // Handle tap on image - either select existing hold or create new one
  const handleTapAtPosition = useCallback((x: number, y: number) => {
    if (!imageWidth || !imageHeight) return;
    
    const scale = imageScale.value;
    const translateX = imageTranslateX.value;
    const translateY = imageTranslateY.value;
    
    // Account for the image offset due to resizeMode="contain" (letterboxing)
    // The tap x,y is relative to container, but image may be offset
    const tapInImageAreaX = x - imageOffsetX;
    const tapInImageAreaY = y - imageOffsetY;
    
    // The image is scaled from its center
    // First, find the center of the displayed image area
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    
    // The tap position relative to the center of the displayed image
    const tapFromCenterX = tapInImageAreaX - centerX;
    const tapFromCenterY = tapInImageAreaY - centerY;
    
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
      // Numbering mode: tap a hold to number it
      if (numberingModeRef.current) {
        const existingHold = findHoldAtPosition(normalizedX, normalizedY);
        if (existingHold && onNumberHold) {
          onNumberHold(existingHold);
        }
        return;
      }
      // Drawing mode: don't create holds on tap
      if (drawingModeRef.current) return;
      // Normal mode: select or create
      const existingHold = findHoldAtPosition(normalizedX, normalizedY);
      if (existingHold && onSelectHold) {
        onSelectHold(existingHold);
      } else if (onCreateHold) {
        onCreateHold(normalizedX, normalizedY);
      }
    }
  }, [imageWidth, imageHeight, imageOffsetX, imageOffsetY, findHoldAtPosition, onSelectHold, onCreateHold, onNumberHold]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    imageScale.value = withSpring(1);
    imageTranslateX.value = withSpring(0);
    imageTranslateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  // Convert screen coordinates to normalized 0-1 coordinates
  const screenToNormalized = useCallback((x: number, y: number) => {
    if (!imageWidth || !imageHeight) return null;
    const scale = imageScale.value;
    const translateX = imageTranslateX.value;
    const translateY = imageTranslateY.value;
    const tapInImageAreaX = x - imageOffsetX;
    const tapInImageAreaY = y - imageOffsetY;
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    const tapFromCenterX = tapInImageAreaX - centerX;
    const tapFromCenterY = tapInImageAreaY - centerY;
    const relativeToImageCenterX = tapFromCenterX - translateX;
    const relativeToImageCenterY = tapFromCenterY - translateY;
    const unscaledX = relativeToImageCenterX / scale;
    const unscaledY = relativeToImageCenterY / scale;
    const normalizedX = (centerX + unscaledX) / imageWidth;
    const normalizedY = (centerY + unscaledY) / imageHeight;
    if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
      return { x: normalizedX, y: normalizedY };
    }
    return null;
  }, [imageWidth, imageHeight, imageOffsetX, imageOffsetY]);

  // Drawing: start stroke
  const handleDrawingStart = useCallback((x: number, y: number) => {
    const pt = screenToNormalized(x, y);
    if (pt) {
      currentDrawingPoints.current = [pt];
    }
  }, [screenToNormalized]);

  // Drawing: update stroke (add point)
  const handleDrawingMove = useCallback((x: number, y: number) => {
    const pt = screenToNormalized(x, y);
    if (pt) {
      currentDrawingPoints.current.push(pt);
    }
  }, [screenToNormalized]);

  // Drawing: end stroke
  const handleDrawingEnd = useCallback(() => {
    const points = currentDrawingPoints.current;
    if (points.length >= 2 && onAddMaskPath) {
      onAddMaskPath({ points: [...points], strokeWidth: 0.03 });
    }
    currentDrawingPoints.current = [];
  }, [onAddMaskPath]);

  // === GESTURES ===

  // Tap gesture - select existing hold or create new one (only when no active hold)
  // maxDistance ensures a drag/pan that ends won't be mistaken for a tap
  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .onEnd((event) => {
      if (!hasActiveHold.value) {
        runOnJS(handleTapAtPosition)(event.x, event.y);
      }
    });

  // Double tap to reset zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(10)
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

  // Pan gesture - move image OR move active hold OR draw mask
  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onStart((event) => {
      if (isDrawingMode.value) {
        // Drawing mode - start a new stroke
        runOnJS(handleDrawingStart)(event.x, event.y);
      } else if (hasActiveHold.value) {
        startHoldX.value = currentHoldX.value;
        startHoldY.value = currentHoldY.value;
      } else {
        savedTranslateX.value = imageTranslateX.value;
        savedTranslateY.value = imageTranslateY.value;
      }
    })
    .onUpdate((event) => {
      if (isDrawingMode.value) {
        // Drawing mode - add point to stroke
        runOnJS(handleDrawingMove)(event.x, event.y);
      } else if (hasActiveHold.value) {
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
      if (isDrawingMode.value) {
        // Drawing mode - finish stroke
        runOnJS(handleDrawingEnd)();
      } else if (hasActiveHold.value) {
        // Update React state only at the end
        runOnJS(updateHoldPosition)(currentHoldX.value, currentHoldY.value);
      }
    });

  // Combine gestures:
  // - Pan and Pinch run simultaneously (zoom + pan at the same time)
  // - Race ensures that if pan/pinch activates, tap gestures are cancelled
  //   (prevents a pan release from being interpreted as a tap that creates a hold)
  const panPinchGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const tapGestures = Gesture.Exclusive(doubleTapGesture, tapGesture);
  const composedGesture = Gesture.Race(panPinchGesture, tapGestures);

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
    <View style={styles.container}>
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
                imageOffsetX={imageOffsetX}
                imageOffsetY={imageOffsetY}
                activeHold={activeHold}
                activeHoldX={currentHoldX}
                activeHoldY={currentHoldY}
                activeHoldRadius={currentRadius}
                holdNumbering={holdNumbering}
                maskPaths={maskPaths}
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
    </View>
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
    direction: 'ltr' as const,
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
