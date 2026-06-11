import React, { useRef, useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { clampViewport } from '@/utils/coordinateUtils';
import { MapTransforms } from '../types/route';

export interface UseMapTransformsConfig {
  minScale?: number; // Default: 1 (initial view size)
  maxScale?: number;
  screenWidth: number;
  screenHeight: number;
  imageWidth: number;
  imageHeight: number;
  onTransformChange?: (transforms: MapTransforms) => void;
}

export function useMapTransforms({
  minScale = 1, // Set minimum scale to 1 (initial view size)
  maxScale = 8,
  screenWidth,
  screenHeight,
  imageWidth,
  imageHeight,
  onTransformChange,
}: UseMapTransformsConfig) {
  const LOG = __DEV__ && false; // הפוך ל-true כשצריך דיבוג
  if (LOG) console.log('🔍 useMapTransforms init:', {
    minScale, maxScale, screenWidth, screenHeight, imageWidth, imageHeight
  });

  // ✅ Safety: וידוא שכל הפרמטרים תקינים
  const safeMinScale = Math.max(1, isFinite(minScale) ? minScale : 1); // Ensure min scale is at least 1
  const safeMaxScale = Math.max(safeMinScale, isFinite(maxScale) ? maxScale : 4);
  const safeScreenWidth = Math.max(1, isFinite(screenWidth) ? screenWidth : 1);
  const safeScreenHeight = Math.max(1, isFinite(screenHeight) ? screenHeight : 1);
  const safeImageWidth = Math.max(1, isFinite(imageWidth) ? imageWidth : 1);
  const safeImageHeight = Math.max(1, isFinite(imageHeight) ? imageHeight : 1);

  if (LOG) console.log('🔍 useMapTransforms safe values:', {
    safeMinScale, safeMaxScale, safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight
  });

  // ✅ הגנה מפני ping-pong - זוכר ערכים אחרונים שנשלחו
  const lastSentRef = useRef<MapTransforms>({ scale: 1, translateX: 0, translateY: 0 });
  const EPS = 0.08; // סבילות קטנה לרעידות

  const onTransformChangeGuarded = useCallback((t: MapTransforms) => {
    const p = lastSentRef.current;
    const near = (a: number, b: number) => Math.abs(a - b) < EPS;
    if (near(p.scale, t.scale) && near(p.translateX, t.translateX) && near(p.translateY, t.translateY)) {
      return; // אל תטריג loop
    }
    lastSentRef.current = t;
    onTransformChange?.(t);
  }, [onTransformChange]);

  // Shared values for transforms - initialize with safe values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Track dimensions for detecting changes
  const prevDimensionsRef = useRef({ imgW: 0, imgH: 0, screenW: 0, screenH: 0 });

  // Apply initial centering when dimensions are available or change
  React.useEffect(() => {
    const prev = prevDimensionsRef.current;
    const dimensionsChanged = 
      prev.imgW !== safeImageWidth || 
      prev.imgH !== safeImageHeight ||
      prev.screenW !== safeScreenWidth ||
      prev.screenH !== safeScreenHeight;
    
    if (dimensionsChanged && safeImageWidth > 1 && safeImageHeight > 1 && safeScreenWidth > 1 && safeScreenHeight > 1) {
      prevDimensionsRef.current = { 
        imgW: safeImageWidth, 
        imgH: safeImageHeight, 
        screenW: safeScreenWidth, 
        screenH: safeScreenHeight 
      };
      
      // Calculate initial centered position
      const initialCentered = clampViewport(
        { scale: 1, translateX: 0, translateY: 0 },
        safeScreenWidth,
        safeScreenHeight,
        safeImageWidth,
        safeImageHeight,
        safeMinScale,
        safeMaxScale
      );
      translateX.value = initialCentered.translateX;
      translateY.value = initialCentered.translateY;
      scale.value = 1;
      if (onTransformChange) {
        onTransformChangeGuarded(initialCentered);
      }
    }
  }, [safeImageWidth, safeImageHeight, safeScreenWidth, safeScreenHeight, safeMinScale, safeMaxScale, onTransformChange, onTransformChangeGuarded]);

  // Gesture state
  const baseScale = useSharedValue(1);
  const baseTranslateX = useSharedValue(0);
  const baseTranslateY = useSharedValue(0);
  // Store IMAGE coordinates of focal point (not screen coordinates)
  const focalImageX = useSharedValue(0);
  const focalImageY = useSharedValue(0);

  // Helper to safely clamp and apply transforms
  const clampAndApply = (newScale: number, newTranslateX: number, newTranslateY: number) => {
    'worklet';

    if (!safeScreenWidth || !safeScreenHeight || !safeImageWidth || !safeImageHeight) {
      return;
    }

    const safeNewScale = Math.max(0.1, isFinite(newScale) ? newScale : 1);
    const safeNewTranslateX = isFinite(newTranslateX) ? newTranslateX : 0;
    const safeNewTranslateY = isFinite(newTranslateY) ? newTranslateY : 0;

    const clamped = clampViewport(
      { scale: safeNewScale, translateX: safeNewTranslateX, translateY: safeNewTranslateY },
      safeScreenWidth,
      safeScreenHeight,
      safeImageWidth,
      safeImageHeight,
      safeMinScale,
      safeMaxScale
    );

    scale.value = isFinite(clamped.scale) ? clamped.scale : 1;
    translateX.value = isFinite(clamped.translateX) ? clamped.translateX : 0;
    translateY.value = isFinite(clamped.translateY) ? clamped.translateY : 0;

    if (onTransformChange) {
      runOnJS(onTransformChangeGuarded)({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      });
    }
  };

  // Pan gesture using new Gesture API - low minDistance for responsive movement
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .minDistance(2) // Low threshold for responsive start
      .onStart(() => {
        baseTranslateX.value = translateX.value;
        baseTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        const newTranslateX = baseTranslateX.value + event.translationX;
        const newTranslateY = baseTranslateY.value + event.translationY;
        
        // Clamp during gesture to prevent going beyond bounds
        const clamped = clampViewport(
          { scale: scale.value, translateX: newTranslateX, translateY: newTranslateY },
          safeScreenWidth,
          safeScreenHeight,
          safeImageWidth,
          safeImageHeight,
          safeMinScale,
          safeMaxScale
        );
        
        translateX.value = clamped.translateX;
        translateY.value = clamped.translateY;
      })
      .onEnd((event) => {
        // Apply velocity for smoother momentum scrolling
        const velocityX = event.velocityX * 0.12;
        const velocityY = event.velocityY * 0.12;
        
        const projectedX = translateX.value + velocityX;
        const projectedY = translateY.value + velocityY;
        
        const clamped = clampViewport(
          { scale: scale.value, translateX: projectedX, translateY: projectedY },
          safeScreenWidth,
          safeScreenHeight,
          safeImageWidth,
          safeImageHeight,
          safeMinScale,
          safeMaxScale
        );

        // Smoother spring - higher damping reduces bounce
        const springConfig = { damping: 28, stiffness: 120, mass: 0.6 };
        translateX.value = withSpring(clamped.translateX, springConfig);
        translateY.value = withSpring(clamped.translateY, springConfig);

        if (onTransformChange) {
          runOnJS(onTransformChangeGuarded)(clamped);
        }
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale]
  );

  // Pinch gesture - zoom centered on the point between your fingers
  // With transform order [scale, translateX/scale, translateY/scale]:
  // Screen position = (imagePos - imgCenter) * scale + imgCenter + translate
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart((event) => {
        baseScale.value = scale.value;
      })
      .onUpdate((event) => {
        const rawScale = baseScale.value * (event.scale ?? 1);
        const newScale = Math.max(safeMinScale, Math.min(safeMaxScale, rawScale));
        const oldScale = scale.value;

        // Focal point on screen
        const focalX = event.focalX;
        const focalY = event.focalY;
        
        // Image dimensions
        const imgCenterX = safeImageWidth / 2;
        const imgCenterY = safeImageHeight / 2;
        
        // Current transform: screenPos = (imagePos - imgCenter) * oldScale + imgCenter + translate
        // Find image position under focal point:
        const imageX = (focalX - imgCenterX - translateX.value) / oldScale + imgCenterX;
        const imageY = (focalY - imgCenterY - translateY.value) / oldScale + imgCenterY;
        
        // New transform should put same image point at same screen position:
        const newTranslateX = focalX - (imageX - imgCenterX) * newScale - imgCenterX;
        const newTranslateY = focalY - (imageY - imgCenterY) * newScale - imgCenterY;
        
        // Clamp translation during pinch to stay within bounds
        const clamped = clampViewport(
          { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
          safeScreenWidth,
          safeScreenHeight,
          safeImageWidth,
          safeImageHeight,
          safeMinScale,
          safeMaxScale
        );

        scale.value = clamped.scale;
        translateX.value = clamped.translateX;
        translateY.value = clamped.translateY;
      })
      .onEnd(() => {
        const clamped = clampViewport(
          { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
          safeScreenWidth,
          safeScreenHeight,
          safeImageWidth,
          safeImageHeight,
          safeMinScale,
          safeMaxScale
        );

        // Smoother spring - higher damping reduces bounce
        const springConfig = { damping: 28, stiffness: 100, mass: 0.6 };
        scale.value = withSpring(clamped.scale, springConfig);
        translateX.value = withSpring(clamped.translateX, springConfig);
        translateY.value = withSpring(clamped.translateY, springConfig);

        if (onTransformChange) {
          runOnJS(onTransformChangeGuarded)(clamped);
        }
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale]
  );

  // Double tap gesture - zooms to 3x for better detail with higher max zoom
  const doubleTapGesture = useMemo(() =>
    Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        const currentScale = scale.value;
        // Zoom to 3x for better detail, reset if already zoomed
        const targetScale = currentScale < 2.5 ? 3 : 1;
        const springConfig = { damping: 24, stiffness: 110, mass: 0.7 };

        if (targetScale === 1) {
          // Reset to initial centered position
          const centered = clampViewport(
            { scale: 1, translateX: 0, translateY: 0 },
            safeScreenWidth,
            safeScreenHeight,
            safeImageWidth,
            safeImageHeight,
            safeMinScale,
            safeMaxScale
          );
          scale.value = withSpring(1, springConfig);
          translateX.value = withSpring(centered.translateX, springConfig);
          translateY.value = withSpring(centered.translateY, springConfig);
          
          if (onTransformChange) {
            runOnJS(onTransformChangeGuarded)(centered);
          }
        } else {
          const fx = event.x;
          const fy = event.y;
          
          // Calculate image coordinates of the tap point
          const imgX = (fx - translateX.value) / currentScale;
          const imgY = (fy - translateY.value) / currentScale;

          // Calculate new translation to keep that point under the finger
          const newTranslateX = fx - imgX * targetScale;
          const newTranslateY = fy - imgY * targetScale;

          const clamped = clampViewport(
            { scale: targetScale, translateX: newTranslateX, translateY: newTranslateY },
            safeScreenWidth,
            safeScreenHeight,
            safeImageWidth,
            safeImageHeight,
            safeMinScale,
            safeMaxScale
          );

          scale.value = withSpring(clamped.scale, springConfig);
          translateX.value = withSpring(clamped.translateX, springConfig);
          translateY.value = withSpring(clamped.translateY, springConfig);

          if (onTransformChange) {
            runOnJS(onTransformChangeGuarded)(clamped);
          }
        }
      }),
    [safeScreenWidth, safeScreenHeight, safeImageWidth, safeImageHeight, safeMinScale, safeMaxScale]
  );

  // Compose all gestures - pan and pinch work simultaneously, double tap is separate
  const composedGesture = useMemo(() => 
    Gesture.Race(
      doubleTapGesture,
      Gesture.Simultaneous(panGesture, pinchGesture)
    ),
    [panGesture, pinchGesture, doubleTapGesture]
  );

  // Animated style for the map container
  // Transform order [translate, scale]: translate moves the image, then scale from center
  // This means screen position = (imagePos - imgCenter) * scale + imgCenter + translate
  const mapContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    } as any;
  });

  // Reset view function
  const resetView = () => {
    const centered = clampViewport(
      { scale: 1, translateX: 0, translateY: 0 },
      safeScreenWidth,
      safeScreenHeight,
      safeImageWidth,
      safeImageHeight,
      safeMinScale,
      safeMaxScale
    );
    const springConfig = { damping: 15, stiffness: 150 };
    scale.value = withSpring(1, springConfig);
    translateX.value = withSpring(centered.translateX, springConfig);
    translateY.value = withSpring(centered.translateY, springConfig);

    if (onTransformChange) {
      onTransformChangeGuarded(centered);
    }
  };

  // Manual zoom functions
  const zoomIn = () => {
    const currentScale = scale.value || 1;
    const newScale = Math.min(safeMaxScale, currentScale * 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;

    // Calculate image coordinates at center
    const imgX = (centerX - translateX.value) / currentScale;
    const imgY = (centerY - translateY.value) / currentScale;

    // Calculate new translation to keep center point
    const newTranslateX = centerX - imgX * newScale;
    const newTranslateY = centerY - imgY * newScale;

    const clamped = clampViewport(
      { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
      safeScreenWidth,
      safeScreenHeight,
      safeImageWidth,
      safeImageHeight,
      safeMinScale,
      safeMaxScale
    );

    const springConfig = { damping: 15, stiffness: 150 };
    scale.value = withSpring(clamped.scale, springConfig);
    translateX.value = withSpring(clamped.translateX, springConfig);
    translateY.value = withSpring(clamped.translateY, springConfig);

    if (onTransformChange) {
      onTransformChangeGuarded(clamped);
    }
  };

  const zoomOut = () => {
    const currentScale = scale.value || 1;
    const newScale = Math.max(safeMinScale, currentScale / 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;

    // Calculate image coordinates at center
    const imgX = (centerX - translateX.value) / currentScale;
    const imgY = (centerY - translateY.value) / currentScale;

    // Calculate new translation to keep center point
    const newTranslateX = centerX - imgX * newScale;
    const newTranslateY = centerY - imgY * newScale;

    const clamped = clampViewport(
      { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
      safeScreenWidth,
      safeScreenHeight,
      safeImageWidth,
      safeImageHeight,
      safeMinScale,
      safeMaxScale
    );

    const springConfig2 = { damping: 15, stiffness: 150 };
    scale.value = withSpring(clamped.scale, springConfig2);
    translateX.value = withSpring(clamped.translateX, springConfig2);
    translateY.value = withSpring(clamped.translateY, springConfig2);

    if (onTransformChange) {
      onTransformChangeGuarded(clamped);
    }
  };

  // Memoize the returned object to keep a stable reference where possible
  return useMemo(() => ({
    // Shared values
    scale,
    translateX,
    translateY,

    // Gesture handlers (new Gesture API)
    panGesture,
    pinchGesture,
    doubleTapGesture,
    composedGesture,

    // Animated styles
    mapContainerStyle,

    // Actions
    resetView,
    zoomIn,
    zoomOut,

    // Config
    minScale,
    maxScale,
  }), [
    panGesture,
    pinchGesture,
    doubleTapGesture,
    composedGesture,
    mapContainerStyle,
    resetView,
    zoomIn,
    zoomOut,
    minScale,
    maxScale,
    scale,
    translateX,
    translateY,
  ]);
}
