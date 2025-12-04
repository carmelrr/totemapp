import { useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';

export interface UseMapTransformsConfig {
  screenWidth: number;
  screenHeight: number;
  imageWidth: number;
  imageHeight: number;
  minScale?: number;
  maxScale?: number;
  onTransformChange?: (transform: {
    scale: number;
    translateX: number;
    translateY: number;
  }) => void;
}

/**
 * Hook לניהול טרנספורמציות המפה (Pan/Zoom) עם Reanimated 3
 * מחזיר מטריצת טרנספורם יציבה ופונקציות זום
 */
export function useMapTransforms({
  screenWidth,
  screenHeight,
  imageWidth,
  imageHeight,
  minScale = 1, // Set minimum scale to 1 (initial view size)
  maxScale = 4,
  onTransformChange,
}: UseMapTransformsConfig) {
  
  console.log('[useMapTransforms] INIT with config:', {
    screenWidth, screenHeight, imageWidth, imageHeight, minScale, maxScale
  });
  
  // ערכים בטוחים למניעת חלוקה באפס
  const safeScreenWidth = Math.max(1, screenWidth || 1);
  const safeScreenHeight = Math.max(1, screenHeight || 1);
  const safeImageWidth = Math.max(1, imageWidth || 1);
  const safeImageHeight = Math.max(1, imageHeight || 1);
  
  // Shared values עבור הטרנספורם
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Throttled notification state
  const lastNotifyScale = useSharedValue(1);
  const lastNotifyX = useSharedValue(0);
  const lastNotifyY = useSharedValue(0);
  
  // ערכי בסיס לגסטורות
  const baseScale = useSharedValue(1);
  const baseTranslateX = useSharedValue(0);
  const baseTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // פונקציה לקליפינג והחלת טרנספורם
  const clampAndApply = useCallback((newScale: number, newX: number, newY: number) => {
    'worklet';
    
    // קליפינג של סקייל
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    // חישוב גבולות תרגום
    const scaledImageWidth = safeImageWidth * clampedScale;
    const scaledImageHeight = safeImageHeight * clampedScale;
    
    const maxTranslateX = Math.max(0, (scaledImageWidth - safeScreenWidth) / 2);
    const maxTranslateY = Math.max(0, (scaledImageHeight - safeScreenHeight) / 2);
    
    const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
    const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));
    
    // החלת הערכים
    scale.value = clampedScale;
    translateX.value = clampedX;
    translateY.value = clampedY;
    
    // התראה לקומפוננט ההורה
    if (onTransformChange) {
      runOnJS(onTransformChange)({
        scale: clampedScale,
        translateX: clampedX,
        translateY: clampedY,
      });
    }
  }, [minScale, maxScale, safeImageWidth, safeImageHeight, safeScreenWidth, safeScreenHeight, onTransformChange]);

  // Notify JS with a small threshold to avoid spamming during gestures
  const notifyIfChanged = useCallback((s: number, x: number, y: number) => {
    'worklet';
    const ds = Math.abs(s - lastNotifyScale.value);
    const dx = Math.abs(x - lastNotifyX.value);
    const dy = Math.abs(y - lastNotifyY.value);
    if (ds > 0.01 || dx > 4 || dy > 4) {
      lastNotifyScale.value = s;
      lastNotifyX.value = x;
      lastNotifyY.value = y;
      if (onTransformChange) {
        runOnJS(onTransformChange)({ scale: s, translateX: x, translateY: y });
      }
    }
  }, [onTransformChange]);

  // Helper to clamp values inline (for use during gestures)
  const clampTranslation = useCallback((currentScale: number, newX: number, newY: number) => {
    'worklet';
    const clampedScale = Math.max(minScale, Math.min(maxScale, currentScale));
    const scaledImageWidth = safeImageWidth * clampedScale;
    const scaledImageHeight = safeImageHeight * clampedScale;
    
    const maxTranslateX = Math.max(0, (scaledImageWidth - safeScreenWidth) / 2);
    const maxTranslateY = Math.max(0, (scaledImageHeight - safeScreenHeight) / 2);
    
    return {
      x: Math.max(-maxTranslateX, Math.min(maxTranslateX, newX)),
      y: Math.max(-maxTranslateY, Math.min(maxTranslateY, newY)),
    };
  }, [minScale, maxScale, safeImageWidth, safeImageHeight, safeScreenWidth, safeScreenHeight]);

  // Helper function to log from worklet (disabled for performance)
  // const logFromWorklet = useCallback((message: string, data: any) => {
  //   console.log(message, data);
  // }, []);

  // Pan gesture using new Gesture API
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .minDistance(5) // Require minimum movement to start
      .onStart(() => {
        baseTranslateX.value = translateX.value;
        baseTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        const newX = baseTranslateX.value + event.translationX;
        const newY = baseTranslateY.value + event.translationY;
        // Clamp during gesture to prevent going beyond bounds
        const clamped = clampTranslation(scale.value, newX, newY);
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd((event) => {
        // Add velocity-based momentum with spring animation
        const velocityX = event.velocityX * 0.1;
        const velocityY = event.velocityY * 0.1;
        
        const targetX = translateX.value + velocityX;
        const targetY = translateY.value + velocityY;
        const clamped = clampTranslation(scale.value, targetX, targetY);
        
        translateX.value = withSpring(clamped.x, {
          velocity: event.velocityX,
          damping: 20,
          stiffness: 200,
        });
        translateY.value = withSpring(clamped.y, {
          velocity: event.velocityY,
          damping: 20,
          stiffness: 200,
        });
      }),
    [clampTranslation]
  );

  // Pinch gesture using new Gesture API
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart((event) => {
        baseScale.value = scale.value;
        baseTranslateX.value = translateX.value;
        baseTranslateY.value = translateY.value;
        focalX.value = event.focalX;
        focalY.value = event.focalY;
      })
      .onUpdate((event) => {
        // Smooth scale calculation with clamping
        const rawScale = baseScale.value * (event.scale ?? 1);
        const newScale = Math.max(minScale, Math.min(maxScale, rawScale));
        
        // Calculate zoom around focal point
        const scaleRatio = newScale / baseScale.value;
        
        // Adjust translation to zoom around focal point
        const newTranslateX = focalX.value - (focalX.value - baseTranslateX.value) * scaleRatio;
        const newTranslateY = focalY.value - (focalY.value - baseTranslateY.value) * scaleRatio;
        
        // Clamp translation during pinch
        const clamped = clampTranslation(newScale, newTranslateX, newTranslateY);
        
        scale.value = newScale;
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      })
      .onEnd((event) => {
        // Smooth spring animation to final position
        const finalScale = Math.max(minScale, Math.min(maxScale, scale.value));
        const clamped = clampTranslation(finalScale, translateX.value, translateY.value);
        
        scale.value = withSpring(finalScale, {
          damping: 15,
          stiffness: 150,
        });
        translateX.value = withSpring(clamped.x, {
          damping: 15,
          stiffness: 150,
        });
        translateY.value = withSpring(clamped.y, {
          damping: 15,
          stiffness: 150,
        });
      }),
    [clampTranslation, minScale, maxScale]
  );

  // Double tap gesture using new Gesture API
  const doubleTapGesture = useMemo(() =>
    Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        const currentScale = scale.value;
        const targetScale = currentScale < 2 ? 2 : 1;
        
        if (targetScale === 1) {
          // איפוס מבט
          scale.value = withSpring(1);
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          
          if (onTransformChange) {
            runOnJS(onTransformChange)({ scale: 1, translateX: 0, translateY: 0 });
          }
        } else {
          // זום פנימה סביב נקודת הלחיצה
          const fx = event.x;
          const fy = event.y;
          const scaleDiff = targetScale - currentScale;
          
          const newTranslateX = translateX.value - (fx - translateX.value) * (scaleDiff / currentScale);
          const newTranslateY = translateY.value - (fy - translateY.value) * (scaleDiff / currentScale);
          
          scale.value = withSpring(targetScale);
          translateX.value = withSpring(newTranslateX);
          translateY.value = withSpring(newTranslateY);
          
          if (onTransformChange) {
            runOnJS(onTransformChange)({
              scale: targetScale,
              translateX: newTranslateX,
              translateY: newTranslateY,
            });
          }
        }
      }),
    [onTransformChange]
  );

  // Compose all gestures - pan and pinch work simultaneously, double tap is separate
  const composedGesture = useMemo(() => 
    Gesture.Race(
      doubleTapGesture,
      Gesture.Simultaneous(panGesture, pinchGesture)
    ),
    [panGesture, pinchGesture, doubleTapGesture]
  );

  // סטייל אנימטיבי לקונטיינר המפה
  const mapContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    } as any;
  });

  // פונקציות זום מתוכנתות
  const zoomIn = useCallback(() => {
    const newScale = Math.min(maxScale, scale.value * 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * (scaleDiff / scale.value);
    const newTranslateY = translateY.value - (centerY - translateY.value) * (scaleDiff / scale.value);
    
    scale.value = withTiming(newScale);
    translateX.value = withTiming(newTranslateX);
    translateY.value = withTiming(newTranslateY);
  }, [maxScale, safeScreenWidth, safeScreenHeight]);

  const zoomOut = useCallback(() => {
    const newScale = Math.max(minScale, scale.value / 1.5);
    const centerX = safeScreenWidth / 2;
    const centerY = safeScreenHeight / 2;
    
    const scaleDiff = newScale - scale.value;
    const newTranslateX = translateX.value - (centerX - translateX.value) * (scaleDiff / scale.value);
    const newTranslateY = translateY.value - (centerY - translateY.value) * (scaleDiff / scale.value);
    
    scale.value = withTiming(newScale);
    translateX.value = withTiming(newTranslateX);
    translateY.value = withTiming(newTranslateY);
  }, [minScale, safeScreenWidth, safeScreenHeight]);

  const resetView = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  }, []);

  // החזרת אובייקט יציב
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
    
    // Styles
    mapContainerStyle,
    
    // Actions
    zoomIn,
    zoomOut,
    resetView,
  }), [
    scale,
    translateX, 
    translateY,
    panGesture,
    pinchGesture,
    doubleTapGesture,
    composedGesture,
    mapContainerStyle,
    zoomIn,
    zoomOut,
    resetView,
  ]);
}
